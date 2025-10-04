// routes/expense.js
const express = require('express');
const router = express.Router();
const { authenticateJWT } = require('../middleware/auth');
const expenseCtrl = require('../controllers/expenseController');

// all expense routes require authentication
router.use(authenticateJWT);

// submit expense
router.post('/expenses', expenseCtrl.createExpense);

// list expenses
router.get('/expenses', expenseCtrl.listExpenses);

// pending approvals for current user (manager / approver)
router.get('/approvals/pending', expenseCtrl.listPendingApprovals);

// approve / reject
router.post('/expenses/:id/approve', expenseCtrl.approveExpense);
router.post('/expenses/:id/reject', expenseCtrl.rejectExpense);

module.exports = router;
