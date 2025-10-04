// controllers/adminController.js
/**
 * Admin controller that operates with:
 * - existing User model (unchanged)
 * - existing Company model (expects embedded arrays: defaultApprovalFlows, approvalRules)
 * - existing Expense model (unchanged)
 *
 * Note: This controller DOES NOT modify any models. It assumes your Company schema
 * contains embedded arrays `defaultApprovalFlows` and `approvalRules`. If those arrays
 * do not exist, the controller will create them in-company document on first write.
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const Expense = require('../models/Expense');
const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 10;

/* -----------------------
   Helpers
   ----------------------- */

function badRequest(res, msg) {
  return res.status(400).json({ error: msg || 'Bad Request' });
}
function notFound(res, msg) {
  return res.status(404).json({ error: msg || 'Not found' });
}
function forbidden(res, msg) {
  return res.status(403).json({ error: msg || 'Forbidden' });
}
function serverErr(res, err) {
  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
}

/**
 * Ensure requested resource belongs to admin's company
 */
function ensureCompanyMatch(reqCompanyId, targetCompanyId) {
  return String(reqCompanyId) === String(targetCompanyId);
}

/* -----------------------
   User management
   ----------------------- */

/**
 * POST /api/admin/users
 * Body: { name, email, password, role = 'employee', manager (optional), isManagerApprover }
 */
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

async function createUser(req, res) {
  try {
    const adminCompanyId = req.user.company;
    const {
      name,
      email,
      role = "employee",
      manager,
      isManagerApprover = false,
    } = req.body;

    if (!email)
      return badRequest(res, "Email is required to create a user.");

    // ✅ Check if user already exists
    const existing = await User.findOne({
      email: email.toLowerCase(),
    });
    if (existing) {
      return res.status(409).json({
        error: "Email already exists",
      });
    }

    // ✅ Manager validation (if passed)
    if (manager) {
      if (!mongoose.isValidObjectId(manager))
        return badRequest(res, "Invalid manager id");
      const mgr = await User.findById(manager);
      if (!mgr || !ensureCompanyMatch(adminCompanyId, mgr.company)) {
        return badRequest(res, "Manager must belong to your company");
      }
    }

    // ✅ 1) Auto-generate a temp password
    const tempPassword = generateTempPassword();

    // ✅ 2) Hash the password
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    // ✅ 3) Create user with hashed password
    const user = new User({
      name: name || "",
      email: email.toLowerCase(),
      passwordHash,
      role,
      company: adminCompanyId,
      manager: manager || null,
      isManagerApprover: !!isManagerApprover,
      meta: { createdBy: req.user.id },
    });

    await user.save();

    // ✅ 4) Send email with the temp password
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const mailOptions = {
      from: `"ExpenseTracker Support" <${process.env.GMAIL_USER}>`,
      to: user.email,
      subject: "Your Account Login Details",
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
                <h2>Welcome to ExpenseTracker!</h2>
            </div>
            <div class="content">
                <p>Hello,</p>
                <p>Your account has been created. Here are your login credentials:</p>
                
                <p><strong>Email:</strong> ${user.email}</p>
                <div class="password-box">
                    <strong style="font-size: 18px; letter-spacing: 2px;">${tempPassword}</strong>
                </div>
                
                <p><strong>Next Steps:</strong></p>
                <ul>
                    <li>Log in using the credentials above</li>
                    <li>Change your password after first login</li>
                    <li>Explore your dashboard and start tracking expenses</li>
                </ul>
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

    await transporter.sendMail(mailOptions);

    // ✅ 5) Return created user (without sensitive fields)
    const out = user.toJSON();
    delete out.passwordHash;
    delete out.refreshTokenHash;
    return res.status(201).json({ user: out, sentPassword: true });
  } catch (err) {
    return serverErr(res, err);
  }
}

/**
 * GET /api/admin/users
 * Query: ?role=&search=&page=&limit=
 */
async function listUsers(req, res) {
  try {
    const companyId = req.user.company;
    const { role, search, page = 1, limit = 50 } = req.query;
    const q = { company: companyId };
    if (role) q.role = role;
    if (search) q.$or = [{ name: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }];

    const docs = await User.find(q)
      .select('-passwordHash -refreshTokenHash')
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .lean();

    return res.json({ users: docs, page: Number(page), limit: Number(limit) });
  } catch (err) {
    return serverErr(res, err);
  }
}

/**
 * GET /api/admin/users/:id
 */
async function getUser(req, res) {
  try {
    const companyId = req.user.company;
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return badRequest(res, 'Invalid user id');

    const user = await User.findById(id).select('-passwordHash -refreshTokenHash').lean();
    if (!user) return notFound(res, 'User not found');
    if (!ensureCompanyMatch(companyId, user.company)) return forbidden(res, 'Forbidden');

    return res.json({ user });
  } catch (err) {
    return serverErr(res, err);
  }
}

/**
 * PATCH /api/admin/users/:id
 * Body may contain: { name, role, manager, isManagerApprover, password }
 */
async function updateUser(req, res) {
  try {
    const companyId = req.user.company;
    const { id } = req.params;
    const { name, role, manager, isManagerApprover, password } = req.body;
    if (!mongoose.isValidObjectId(id)) return badRequest(res, 'Invalid user id');

    const user = await User.findById(id);
    if (!user) return notFound(res, 'User not found');
    if (!ensureCompanyMatch(companyId, user.company)) return forbidden(res, 'Forbidden');

    if (name) user.name = name;
    if (role) {
      if (!['admin', 'manager', 'employee'].includes(role)) return badRequest(res, 'Invalid role');
      user.role = role;
    }
    if (typeof isManagerApprover !== 'undefined') user.isManagerApprover = !!isManagerApprover;
    if (manager) {
      if (!mongoose.isValidObjectId(manager)) return badRequest(res, 'Invalid manager id');
      const mgr = await User.findById(manager);
      if (!mgr || !ensureCompanyMatch(companyId, mgr.company)) return badRequest(res, 'Manager must belong to your company');
      user.manager = manager;
    }
    if (password) {
      if (typeof user.setPassword === 'function') {
        await user.setPassword(password);
      } else {
        user.passwordHash = password;
      }
      if (typeof user.invalidateRefreshTokens === 'function') {
        await user.invalidateRefreshTokens();
      } else {
        user.refreshTokenHash = null;
      }
    }

    await user.save();
    const out = user.toJSON();
    delete out.passwordHash;
    delete out.refreshTokenHash;
    return res.json({ user: out });
  } catch (err) {
    return serverErr(res, err);
  }
}

/**
 * DELETE /api/admin/users/:id
 */
async function deleteUser(req, res) {
  try {
    const companyId = req.user.company;
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return badRequest(res, 'Invalid user id');

    const user = await User.findById(id);
    if (!user) return notFound(res, 'User not found');
    if (!ensureCompanyMatch(companyId, user.company)) return forbidden(res, 'Forbidden');

    await User.deleteOne({ _id: id });
    return res.json({ message: 'User deleted' });
  } catch (err) {
    return serverErr(res, err);
  }
}

/* -----------------------
   Approval flows & rules (embedded in Company)
   ----------------------- */

/**
 * Helper: load company document for admin (with flows & rules)
 */
async function loadCompanyForAdmin(adminCompanyId) {
  const company = await Company.findById(adminCompanyId);
  if (!company) throw new Error('Company not found');
  // ensure arrays exist
  if (!Array.isArray(company.defaultApprovalFlows)) company.defaultApprovalFlows = [];
  if (!Array.isArray(company.approvalRules)) company.approvalRules = [];
  return company;
}

/**
 * POST /api/admin/approval-flows
 * Body: { name, description, steps, rule, isDefault, active }
 */
async function createApprovalFlow(req, res) {
  try {
    const companyId = req.user.company;
    const { name, description = '', steps = [], rule = null, isDefault = false, active = true } = req.body;
    if (!name) return badRequest(res, 'name required');

    const company = await loadCompanyForAdmin(companyId);

    if (company.defaultApprovalFlows.some(f => f.name === name)) {
      return res.status(409).json({ error: 'Flow name exists' });
    }

    const newFlow = {
      _id: new mongoose.Types.ObjectId(),
      name,
      description,
      steps,
      rule,
      isDefault: !!isDefault,
      active: !!active
    };

    // push
    company.defaultApprovalFlows.push(newFlow);

    // ensure only one default
    if (newFlow.isDefault) {
      company.defaultApprovalFlows = company.defaultApprovalFlows.map(f => {
        if (String(f._id) !== String(newFlow._id)) f.isDefault = false;
        return f;
      });
    }

    await company.save();
    return res.status(201).json({ flow: newFlow });
  } catch (err) {
    if (String(err.message) === 'Company not found') return notFound(res, 'Company not found');
    return serverErr(res, err);
  }
}

/**
 * GET /api/admin/approval-flows
 */
async function listApprovalFlows(req, res) {
  try {
    const companyId = req.user.company;
    const company = await Company.findById(companyId).lean();
    if (!company) return notFound(res, 'Company not found');
    return res.json({ flows: company.defaultApprovalFlow || [] });
  } catch (err) {
    return serverErr(res, err);
  }
}

/**
 * GET /api/admin/approval-flows/:id
 */
async function getApprovalFlow(req, res) {
  try {
    const companyId = req.user.company;
    const { id } = req.params;
    const company = await Company.findById(companyId).lean();
    if (!company) return notFound(res, 'Company not found');

    const flow = (company.defaultApprovalFlows || []).find(f => String(f._id) === String(id));
    if (!flow) return notFound(res, 'Flow not found');
    return res.json({ flow });
  } catch (err) {
    return serverErr(res, err);
  }
}

/**
 * PATCH /api/admin/approval-flows/:id
 * Body: updates
 */
async function updateApprovalFlow(req, res) {
  try {
    const companyId = req.user.company;
    const { id } = req.params;
    const updates = req.body;
    const company = await loadCompanyForAdmin(companyId);

    const idx = (company.defaultApprovalFlows || []).findIndex(f => String(f._id) === String(id));
    if (idx === -1) return notFound(res, 'Flow not found');

    const flow = company.defaultApprovalFlows[idx];
    if (typeof updates.name !== 'undefined') flow.name = updates.name;
    if (typeof updates.description !== 'undefined') flow.description = updates.description;
    if (Array.isArray(updates.steps)) flow.steps = updates.steps;
    if (typeof updates.rule !== 'undefined') flow.rule = updates.rule;
    if (typeof updates.active !== 'undefined') flow.active = !!updates.active;
    if (typeof updates.isDefault !== 'undefined') {
      if (updates.isDefault) {
        company.defaultApprovalFlows.forEach(f => f.isDefault = false);
      }
      flow.isDefault = !!updates.isDefault;
    }

    company.defaultApprovalFlows[idx] = flow;
    await company.save();
    return res.json({ flow });
  } catch (err) {
    if (String(err.message) === 'Company not found') return notFound(res, 'Company not found');
    return serverErr(res, err);
  }
}

/**
 * DELETE /api/admin/approval-flows/:id
 */
async function deleteApprovalFlow(req, res) {
  try {
    const companyId = req.user.company;
    const { id } = req.params;
    const company = await loadCompanyForAdmin(companyId);

    const before = company.defaultApprovalFlows.length;
    company.defaultApprovalFlows = company.defaultApprovalFlows.filter(f => String(f._id) !== String(id));
    if (company.defaultApprovalFlows.length === before) return notFound(res, 'Flow not found');

    await company.save();
    return res.json({ message: 'Flow deleted' });
  } catch (err) {
    if (String(err.message) === 'Company not found') return notFound(res, 'Company not found');
    return serverErr(res, err);
  }
}

/* -----------------------
   Approval rules (embedded in Company)
   ----------------------- */

/**
 * POST /api/admin/approval-rules
 * Body: { name, type, percentageThreshold, specificApprover, description, enabled }
 */
async function createApprovalRule(req, res) {
  try {
    const companyId = req.user.company;
    const { name, type, percentageThreshold, specificApprover, description = '', enabled = true } = req.body;
    if (!name || !type) return badRequest(res, 'name and type required');

    const company = await loadCompanyForAdmin(companyId);

    if (company.approvalRules.some(r => r.name === name)) {
      return res.status(409).json({ error: 'Rule name exists' });
    }

    const newRule = {
      _id: new mongoose.Types.ObjectId(),
      name,
      type,
      percentageThreshold: typeof percentageThreshold !== 'undefined' ? percentageThreshold : null,
      specificApprover: specificApprover || null,
      description,
      enabled: !!enabled
    };

    company.approvalRules.push(newRule);
    await company.save();
    return res.status(201).json({ rule: newRule });
  } catch (err) {
    if (String(err.message) === 'Company not found') return notFound(res, 'Company not found');
    return serverErr(res, err);
  }
}

/**
 * GET /api/admin/approval-rules
 */
async function listApprovalRules(req, res) {
  try {
    const companyId = req.user.company;
    const company = await Company.findById(companyId).lean();
    if (!company) return notFound(res, 'Company not found');
    return res.json({ rules: company.approvalRules || [] });
  } catch (err) {
    return serverErr(res, err);
  }
}

/**
 * PATCH /api/admin/approval-rules/:id
 */
async function updateApprovalRule(req, res) {
  try {
    const companyId = req.user.company;
    const { id } = req.params;
    const updates = req.body;
    const company = await loadCompanyForAdmin(companyId);

    const idx = (company.approvalRules || []).findIndex(r => String(r._id) === String(id));
    if (idx === -1) return notFound(res, 'Rule not found');

    const r = company.approvalRules[idx];
    if (typeof updates.name !== 'undefined') r.name = updates.name;
    if (typeof updates.type !== 'undefined') r.type = updates.type;
    if (typeof updates.percentageThreshold !== 'undefined') r.percentageThreshold = updates.percentageThreshold;
    if (typeof updates.specificApprover !== 'undefined') r.specificApprover = updates.specificApprover;
    if (typeof updates.description !== 'undefined') r.description = updates.description;
    if (typeof updates.enabled !== 'undefined') r.enabled = !!updates.enabled;

    company.approvalRules[idx] = r;
    await company.save();
    return res.json({ rule: r });
  } catch (err) {
    if (String(err.message) === 'Company not found') return notFound(res, 'Company not found');
    return serverErr(res, err);
  }
}

/**
 * DELETE /api/admin/approval-rules/:id
 */
async function deleteApprovalRule(req, res) {
  try {
    const companyId = req.user.company;
    const { id } = req.params;
    const company = await loadCompanyForAdmin(companyId);

    const before = company.approvalRules.length;
    company.approvalRules = company.approvalRules.filter(r => String(r._id) !== String(id));
    if (company.approvalRules.length === before) return notFound(res, 'Rule not found');

    await company.save();
    return res.json({ message: 'Rule deleted' });
  } catch (err) {
    if (String(err.message) === 'Company not found') return notFound(res, 'Company not found');
    return serverErr(res, err);
  }
}

/* -----------------------
   Expenses & Admin overrides
   ----------------------- */

/**
 * GET /api/admin/expenses
 * Query: ?status=&submittedBy=&page=&limit=&from=&to=
 */
async function listExpenses(req, res) {
  try {
    const companyId = req.user.company;
    const { status, submittedBy, page = 1, limit = 50, from, to } = req.query;
    const q = { company: companyId };
    if (status) q.status = status;
    if (submittedBy) q.submittedBy = submittedBy;
    if (from || to) q.createdAt = {};
    if (from) q.createdAt.$gte = new Date(from);
    if (to) q.createdAt.$lte = new Date(to);

    const expenses = await Expense.find(q)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate('submittedBy', 'name email')
      .lean();

    return res.json({ expenses, page: Number(page), limit: Number(limit) });
  } catch (err) {
    return serverErr(res, err);
  }
}

/**
 * POST /api/admin/expenses/:id/override
 * Body: { action: 'approve'|'reject'|'setStatus', status?, comment? }
 *
 * Uses Expense.approvalHistory and Expense.status fields as you provided.
 */
async function overrideExpense(req, res) {
  try {
    const companyId = req.user.company;
    const adminUserId = req.user.id;
    const { id } = req.params;
    const { action, status, comment = '' } = req.body;
    if (!mongoose.isValidObjectId(id)) return badRequest(res, 'Invalid expense id');

    const expense = await Expense.findById(id);
    if (!expense) return notFound(res, 'Expense not found');
    if (!ensureCompanyMatch(companyId, expense.company)) return forbidden(res, 'Forbidden');

    if (action === 'approve') {
      expense.approvalHistory.push({
        approver: adminUserId,
        roleAtApproval: 'admin',
        decision: 'approved',
        comments: comment || 'Approved by admin override',
        decidedAt: new Date(),
        stepIndex: expense.currentStepIndex || 0
      });
      expense.status = 'approved';
      // leave currentStepIndex as-is or set to end (admin decision)
      await expense.save();
      return res.json({ message: 'Expense approved by admin', expense });
    } else if (action === 'reject') {
      expense.approvalHistory.push({
        approver: adminUserId,
        roleAtApproval: 'admin',
        decision: 'rejected',
        comments: comment || 'Rejected by admin override',
        decidedAt: new Date(),
        stepIndex: expense.currentStepIndex || 0
      });
      expense.status = 'rejected';
      await expense.save();
      return res.json({ message: 'Expense rejected by admin', expense });
    } else if (action === 'setStatus') {
      if (!status) return badRequest(res, 'status required for setStatus');
      // validate allowed statuses
      if (!['pending', 'approved', 'rejected', 'paid'].includes(status)) return badRequest(res, 'Invalid status');
      expense.status = status;
      await expense.save();
      return res.json({ message: `Expense status set to ${status}`, expense });
    } else {
      return badRequest(res, 'Invalid action');
    }
  } catch (err) {
    return serverErr(res, err);
  }
}

/* -----------------------
   Export handlers
   ----------------------- */

module.exports = {
  // users
  createUser,
  listUsers,
  getUser,
  updateUser,
  deleteUser,

  // flows
  createApprovalFlow,
  listApprovalFlows,
  getApprovalFlow,
  updateApprovalFlow,
  deleteApprovalFlow,

  // rules
  createApprovalRule,
  listApprovalRules,
  updateApprovalRule,
  deleteApprovalRule,

  // expenses
  listExpenses,
  overrideExpense
};
