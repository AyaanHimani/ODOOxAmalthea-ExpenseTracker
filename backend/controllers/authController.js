// controllers/authController.js
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const { createCompanyIfNeeded } = require('../services/companyService');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateRandomToken
} = require('../utils/tokenUtils');
const crypto = require('crypto');

// helpers
async function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const SALT_ROUNDS = 12;

// controllers/authController.js (only signup function)
async function signup(req, res) {
  try {
    let { name, email, password, country, currency } = req.body;

    const companyName = name;
    if (!email || !password || !companyName) {
      return res.status(400).json({ error: 'email/password/companyName required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const countryValue = country?.name || null;
    const currencyValue = currency?.code || null;

    const company = await createCompanyIfNeeded(
      companyName,
      countryValue,
      currencyValue
    );

    const usersInCompany = await User.countDocuments({ company: company._id });
    const role = usersInCompany === 0 ? 'admin' : 'employee';

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      role,
      company: company._id,
      isEmailVerified: false
    });

    // ✅ Generate access token like in login()
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      company: user.company ? user.company.toString() : null
    };
    const accessToken = signAccessToken(payload);

    // ✅ Also create a refresh token (same logic as login)
    const refreshTokenPlain = signRefreshToken({
      sub: user._id.toString(),
      jti: uuidv4()
    });
    const refreshHash = await hashToken(refreshTokenPlain);
    user.refreshTokenHash = refreshHash;
    await user.save();

    // ✅ Set refresh token cookie
    res.cookie('refreshToken', refreshTokenPlain, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: parseInt(process.env.REFRESH_TOKEN_TTL || '604800', 10) * 1000
    });

    return res.status(201).json({
      message: 'User created',
      accessToken,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        company: {
          id: company._id,
          name: company.name,
          baseCurrency: company.baseCurrency,
          currency: company.currency
        }
      }
    });

  } catch (err) {
    console.error('signup error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}



async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Missing credentials' });

    const user = await User.findOne({ email: email.toLowerCase() }).populate('company');
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(403).json({ error: 'Account locked. Try later.' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // lock 15m
      }
      await user.save();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Reset counters on successful login
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    // Create access token
    const payload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      company: user.company ? user.company._id.toString() : null
    };
    const accessToken = signAccessToken(payload);

    // Create refresh token
    const refreshTokenPlain = signRefreshToken({
      sub: user._id.toString(),
      jti: uuidv4()
    });
    const refreshHash = await hashToken(refreshTokenPlain);
    user.refreshTokenHash = refreshHash;
    await user.save();

    // Set refresh token cookie
    res.cookie('refreshToken', refreshTokenPlain, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: parseInt(process.env.REFRESH_TOKEN_TTL || '604800', 10) * 1000
    });

    // ✅ Return accessToken + user info (role, company, etc.) for frontend storage
    return res.json({
      message: 'Login successful',
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
              currency: user.company.currency
            }
          : null
      }
    });

  } catch (err) {
    console.error('login err', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function refreshToken(req, res) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return res.status(401).json({ error: 'No refresh token' });

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.refreshTokenHash) return res.status(401).json({ error: 'Invalid session' });

    const hashed = crypto.createHash('sha256').update(token).digest('hex');
    if (hashed !== user.refreshTokenHash) {
      // possible reuse or theft
      user.refreshTokenHash = null;
      await user.save();
      return res.status(401).json({ error: 'Invalid session' });
    }

    // rotate: issue new refresh token and access token
    const newRefresh = signRefreshToken({ sub: user._id.toString(), jti: uuidv4() });
    user.refreshTokenHash = crypto.createHash('sha256').update(newRefresh).digest('hex');
    await user.save();

    const accessPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
      company: user.company ? user.company.toString() : null
    };
    const newAccess = signAccessToken(accessPayload);

    res.cookie('refreshToken', newRefresh, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: parseInt(process.env.REFRESH_TOKEN_TTL || '604800', 10) * 1000
    });

    return res.json({ accessToken: newAccess });
  } catch (err) {
    console.error('refresh err', err);
    return res.status(500).json({ error: 'Internal server error' });
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
    res.clearCookie('refreshToken');
    return res.json({ message: 'Logged out' });
  } catch (err) {
    console.error('logout err', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function me(req, res) {
  // requires authenticateJWT middleware
  try {
    const { id } = req.user;
    const user = await User.findById(id).select('-passwordHash -refreshTokenHash').populate('company');
    if (!user) return res.status(404).json({ error: 'Not found' });
    return res.json({ user });
  } catch (err) {
    console.error('me err', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = { signup, login, refreshToken, logout, me };
