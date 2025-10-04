// routes/admin.js
const express = require('express');
const router = express.Router();
const { authenticateJWT, authorize } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// all routes require Admin role
router.use(authenticateJWT, authorize('admin'));

// Users
router.post('/users', adminController.createUser);         // create employee/manager
router.get('/users', adminController.listUsers);           // list company users
router.get('/users/:id', adminController.getUser);         // get single user
router.patch('/users/:id', adminController.updateUser);    // update role/manager/flags
router.delete('/users/:id', adminController.deleteUser);   // remove user

// Approval Flows
router.post('/approval-flows', adminController.createApprovalFlow);
router.get('/approval-flows', adminController.listApprovalFlows);
router.get('/approval-flows/:id', adminController.getApprovalFlow);
router.patch('/approval-flows/:id', adminController.updateApprovalFlow);
router.delete('/approval-flows/:id', adminController.deleteApprovalFlow);

// Approval Rules
router.post('/approval-rules', adminController.createApprovalRule);
router.get('/approval-rules', adminController.listApprovalRules);
router.patch('/approval-rules/:id', adminController.updateApprovalRule);
router.delete('/approval-rules/:id', adminController.deleteApprovalRule);

// Expenses & overrides
router.get('/expenses', adminController.listExpenses); // company-wide view
router.post('/expenses/:id/override', adminController.overrideExpense); // admin override: approve/reject/set status

module.exports = router;
