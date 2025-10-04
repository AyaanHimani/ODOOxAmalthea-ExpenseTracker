// controllers/authController.js
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const { createCompanyIfNeeded } = require("../services/companyService");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateRandomToken,
} = require("../utils/tokenUtils");
const crypto = require("crypto");

// helpers
async function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const SALT_ROUNDS = 12;

// controllers/authController.js (only signup function)
async function signup(req, res) {
  try {
    let { companyName, email, password, country, currency } = req.body;

    if (!email || !password || !companyName) {
      return res
        .status(400)
        .json({ error: "email/password/companyName required" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    const countryValue = country?.name || null;
    const currencyValue = currency?.code || null;

    const company = await createCompanyIfNeeded(
      companyName,
      countryValue,
      currencyValue
    );

    const usersInCompany = await User.countDocuments({ company: company._id });
    const role = usersInCompany === 0 ? "admin" : "employee";

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role,
      company: company._id,
      isEmailVerified: false,
    });

    // ✅ Generate access token like in login()
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      company: user.company ? user.company.toString() : null,
    };
    const accessToken = signAccessToken(payload);

    // ✅ Also create a refresh token (same logic as login)
    const refreshTokenPlain = signRefreshToken({
      sub: user._id.toString(),
      jti: uuidv4(),
    });
    const refreshHash = await hashToken(refreshTokenPlain);
    user.refreshTokenHash = refreshHash;
    await user.save();

    // ✅ Set refresh token cookie
    res.cookie("refreshToken", refreshTokenPlain, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: parseInt(process.env.REFRESH_TOKEN_TTL || "604800", 10) * 1000,
    });

    return res.status(201).json({
      message: "User created",
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company: {
          id: company._id,
          name: company.name,
          baseCurrency: company.baseCurrency,
          currency: company.currency,
        },
      },
    });
  } catch (err) {
    console.error("signup error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Missing credentials" });

    const user = await User.findOne({ email: email.toLowerCase() }).populate(
      "company"
    );
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ error: "Account locked. Try later." });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // lock 15m
      }
      await user.save();
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Reset counters on successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    // Create access token
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      company: user.company ? user.company._id.toString() : null,
    };
    const accessToken = signAccessToken(payload);

    // Create refresh token
    const refreshTokenPlain = signRefreshToken({
      sub: user._id.toString(),
      jti: uuidv4(),
    });
    const refreshHash = await hashToken(refreshTokenPlain);
    user.refreshTokenHash = refreshHash;
    await user.save();

    // Set refresh token cookie
    res.cookie("refreshToken", refreshTokenPlain, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: parseInt(process.env.REFRESH_TOKEN_TTL || "604800", 10) * 1000,
    });

    // ✅ Return accessToken + user info (role, company, etc.) for frontend storage
    return res.json({
      message: "Login successful",
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company: user.company
          ? {
              id: user.company._id,
              name: user.company.name,
              baseCurrency: user.company.baseCurrency,
              currency: user.company.currency,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("login err", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

function generateTempPassword(length = 8) {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let password = "";

  // Ensure at least one number
  password += charset.slice(52)[Math.floor(Math.random() * 10)];

  // Ensure at least one uppercase letter
  password += charset.slice(26, 52)[Math.floor(Math.random() * 26)];

  // Ensure at least one lowercase letter
  password += charset.slice(0, 26)[Math.floor(Math.random() * 26)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    password += charset[randomIndex];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find user with case-insensitive email search
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res
        .status(404)
        .json({ error: "No account found with this email" });
    }

    // Generate random 8 character alphanumeric password
    const tempPassword = generateTempPassword();

    // Hash the new password
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    // Update user's password hash
    user.passwordHash = passwordHash;
    await user.save();

    // Email configuration
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    // Email content
    const mailOptions = {
      from: `"ExpenseTracker Support" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: "Password Reset Request",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                .email-container {
                    max-width: 600px;
                    margin: 0 auto;
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    background-color: #f9f9f9;
                }
                .header {
                    background-color: #2C3E50;
                    color: white;
                    padding: 20px;
                    text-align: center;
                    border-radius: 5px 5px 0 0;
                }
                .content {
                    background-color: white;
                    padding: 20px;
                    border-radius: 0 0 5px 5px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
                .password-box {
                    background-color: #f8f9fa;
                    border: 1px dashed #dee2e6;
                    padding: 15px;
                    margin: 20px 0;
                    text-align: center;
                    border-radius: 5px;
                }
                .warning {
                    color: #dc3545;
                    font-size: 14px;
                    margin-top: 20px;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #6c757d;
                }
            </style>
        </head>
        <body>
            <div class="email-container">
                <div class="header">
                    <h2>Password Reset</h2>
                </div>
                <div class="content">
                    <p>Hello,</p>
                    <p>We received a request to reset your password. Here's your temporary password:</p>
                    
                    <div class="password-box">
                        <strong style="font-size: 18px; letter-spacing: 2px;">${tempPassword}</strong>
                    </div>
                    
                    <p><strong>Important Security Notes:</strong></p>
                    <ul>
                        <li>This temporary password will expire in 24 hours</li>
                        <li>Please change this password immediately after logging in</li>
                        <li>If you didn't request this reset, please secure your account</li>
                    </ul>
                    
                    <p class="warning">
                        For security reasons, do not share this password with anyone.
                    </p>
                </div>
                <div class="footer">
                    <p>This is an automated message, please do not reply to this email.</p>
                    <p>&copy; ${new Date().getFullYear()} ExpenseTracker. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `,
    };

    // Send email
    await transporter.sendMail(mailOptions);

    return res.json({
      message: "Password reset email sent successfully",
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    return res.status(500).json({
      error: "Failed to process password reset request",
    });
  }
}

async function refreshToken(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: "No refresh token" });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.refreshTokenHash)
      return res.status(401).json({ error: "Invalid session" });

    const hashed = crypto.createHash("sha256").update(token).digest("hex");
    if (hashed !== user.refreshTokenHash) {
      // possible reuse or theft
      user.refreshTokenHash = null;
      await user.save();
      return res.status(401).json({ error: "Invalid session" });
    }

    // rotate: issue new refresh token and access token
    const newRefresh = signRefreshToken({
      sub: user._id.toString(),
      jti: uuidv4(),
    });
    user.refreshTokenHash = crypto
      .createHash("sha256")
      .update(newRefresh)
      .digest("hex");
    await user.save();

    const accessPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      company: user.company ? user.company.toString() : null,
    };
    const newAccess = signAccessToken(accessPayload);

    res.cookie("refreshToken", newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: parseInt(process.env.REFRESH_TOKEN_TTL || "604800", 10) * 1000,
    });

    return res.json({ accessToken: newAccess });
  } catch (err) {
    console.error("refresh err", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function logout(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      // find user and clear the stored refresh hash
      try {
        const payload = verifyRefreshToken(token);
        const user = await User.findById(payload.sub);
        if (user) {
          user.refreshTokenHash = null;
          await user.save();
        }
      } catch (err) {
        // ignore
      }
    }
    res.clearCookie("refreshToken");
    return res.json({ message: "Logged out" });
  } catch (err) {
    console.error("logout err", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function me(req, res) {
  // requires authenticateJWT middleware
  try {
    const { id } = req.user;
    const user = await User.findById(id)
      .select("-passwordHash -refreshTokenHash")
      .populate("company");
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json({ user });
  } catch (err) {
    console.error("me err", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = { signup, login, forgotPassword, refreshToken, logout, me };
