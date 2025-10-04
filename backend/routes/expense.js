// routes/expense.js
const express = require('express');
const router = express.Router();

const { authenticateJWT, authorize } = require('../middleware/auth');
const expenseCtrl = require('../controllers/expenseController');

// All expense routes require authentication
router.use(authenticateJWT);

/**
 * Public for authenticated users:
 * - POST /expenses            -> submit an expense (employee)
 * - GET  /expenses            -> list expenses (own / team / company via query + role)
 */
router.post('/expenses', expenseCtrl.createExpense);
router.get('/expenses', expenseCtrl.listExpenses);

/**
 * Pending approvals:
 * - GET /approvals/pending    -> list pending approvals for the current user
 *   (allowed for managers and admins; employees will just get empty list)
 */
router.get('/approvals/pending', authorize('manager', 'admin'), expenseCtrl.listPendingApprovals);

/**
 * Approve / Reject endpoints:
 * - POST /expenses/:id/approve -> approve expense (manager/admin)
 * - POST /expenses/:id/reject  -> reject expense (manager/admin)
 *
 * Note: authorize('manager','admin') ensures only managers or admins can call these.
 * The approvalService will still verify whether the caller is the correct approver for the specific expense.
 */
router.post('/expenses/:id/approve', authorize('manager', 'admin'), expenseCtrl.approveExpense);
router.post('/expenses/:id/reject', authorize('manager', 'admin'), expenseCtrl.rejectExpense);

module.exports = router;
