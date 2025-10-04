// controllers/expenseController.js
const Expense = require('../models/Expense');
const User = require('../models/User');
const Company = require('../models/Company');
const approvalService = require('../services/approvalService');

/**
 * Create expense (employee)
 * POST /expenses
 * Body: { amountOriginal, currencyOriginal, amountBase, baseCurrency, category, description, expenseDate, approvalFlowName? }
 */
async function createExpense(req, res) {
  try {
    const userId = req.user.id;
    const companyId = req.user.company;
    const {
      merchantName, amountOriginal, currencyOriginal, amountBase, baseCurrency,
      category, description, expenseDate, approvalFlowName
    } = req.body;

    if (!amountOriginal || !currencyOriginal || !amountBase || !baseCurrency || !expenseDate) {
      return res.status(400).json({ error: 'amountOriginal, currencyOriginal, amountBase, baseCurrency and expenseDate are required' });
    }

    const exp = await Expense.create({
      merchantName: merchantName || 'Unknown Merchant',
      company: companyId,
      submittedBy: userId,
      amountOriginal,
      currencyOriginal,
      amountBase,
      baseCurrency,
      category: category || '',
      description: description || '',
      expenseDate: new Date(expenseDate),
      approvalFlowName: approvalFlowName || '',
      currentStepIndex: 0,
      status: 'pending'
    });

    return res.status(201).json({ expense: exp });
  } catch (err) {
    console.error('createExpense err', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /expenses
 * Query:
 *  - employees: ?mine=true (default), admin can pass ?company=true, manager can pass ?team=true to view team expenses
 *  - pagination: page, limit
 */
async function listExpenses(req, res) {
  try {
    const userId = req.user.id;
    const companyId = req.user.company;
    const role = req.user.role;
    const { mine = 'true', company = 'false', team = 'false', status, page = 1, limit = 50 } = req.query;

    const q = {};
    if (role === 'admin' && company === 'true') {
      q.company = companyId;
    } else if (role === 'manager' && team === 'true') {
      // manager: find users who have manager = managerId
      const teamMembers = await User.find({ company: companyId, manager: userId }).select('_id').lean();
      const ids = teamMembers.map(u => u._id);
      q.company = companyId;
      q.submittedBy = { $in: ids };
    } else {
      // default: own expenses
      q.submittedBy = userId;
    }

    if (status) q.status = status;

    const docs = await Expense.find(q).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).lean();
    return res.json({ expenses: docs, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('listExpenses err', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /approvals/pending
 * Returns expenses that are pending and where req.user is a current approver
 */
async function listPendingApprovals(req, res) {
  try {
    const userId = req.user.id;
    const companyId = req.user.company;
    // find all pending expenses in company (could be large; for demo limit/ paginate)
    const pending = await Expense.find({ company: companyId, status: 'pending' }).sort({ createdAt: -1 }).limit(200).lean();
    const results = [];
    for (const p of pending) {
      const isApprover = await approvalService.isUserCurrentApprover(p, userId);
      if (isApprover) results.push(p);
    }
    return res.json({ pending: results });
  } catch (err) {
    console.error('listPendingApprovals err', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /expenses/:id/approve
 * Body: { comments }
 */
async function approveExpense(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { comments = '' } = req.body;
    const result = await approvalService.handleApproval({ expenseId: id, approverId: userId, decision: 'approved', comments });
    return res.json({ message: 'Approved', result });
  } catch (err) {
    console.error('approveExpense err', err);
    const status = err?.status || 500;
    return res.status(status).json({ error: err?.message || 'Internal server error' });
  }
}

/**
 * POST /expenses/:id/reject
 * Body: { comments }
 */
async function rejectExpense(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { comments = '' } = req.body;
    const result = await approvalService.handleApproval({ expenseId: id, approverId: userId, decision: 'rejected', comments });
    return res.json({ message: 'Rejected', result });
  } catch (err) {
    console.error('rejectExpense err', err);
    const status = err?.status || 500;
    return res.status(status).json({ error: err?.message || 'Internal server error' });
  }
}

module.exports = {
  createExpense,
  listExpenses,
  listPendingApprovals,
  approveExpense,
  rejectExpense
};
