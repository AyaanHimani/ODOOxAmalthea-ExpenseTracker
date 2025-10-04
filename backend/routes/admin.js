// routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const { authenticateJWT, authorize } = require('../middleware/auth');

/**
 * NOTE:
 * - All endpoints below require authentication.
 * - Only users with role 'admin' can access them.
 */

/* -----------------------
   USER MANAGEMENT
   ----------------------- */
router.post('/users', authenticateJWT, authorize('admin'), adminController.createUser);
router.get('/users', authenticateJWT, authorize('admin'), adminController.listUsers);
router.get('/users/:id', authenticateJWT, authorize('admin'), adminController.getUser);
router.patch('/users/:id', authenticateJWT, authorize('admin'), adminController.updateUser);
router.delete('/users/:id', authenticateJWT, authorize('admin'), adminController.deleteUser);

/* -----------------------
   APPROVAL FLOWS
   ----------------------- */
router.post('/approval-flows', authenticateJWT, authorize('admin'), adminController.createApprovalFlow);
router.get('/approval-flows', authenticateJWT, authorize('admin'), adminController.listApprovalFlows);
router.get('/approval-flows/:id', authenticateJWT, authorize('admin'), adminController.getApprovalFlow);
router.patch('/approval-flows/:id', authenticateJWT, authorize('admin'), adminController.updateApprovalFlow);
router.delete('/approval-flows/:id', authenticateJWT, authorize('admin'), adminController.deleteApprovalFlow);

/* -----------------------
   APPROVAL RULES
   ----------------------- */
router.post('/approval-rules', authenticateJWT, authorize('admin'), adminController.createApprovalRule);
router.get('/approval-rules', authenticateJWT, authorize('admin'), adminController.listApprovalRules);
router.patch('/approval-rules/:id', authenticateJWT, authorize('admin'), adminController.updateApprovalRule);
router.delete('/approval-rules/:id', authenticateJWT, authorize('admin'), adminController.deleteApprovalRule);

/* -----------------------
   EXPENSE MANAGEMENT (Admin)
   ----------------------- */
router.get('/expenses', authenticateJWT, authorize('admin'), adminController.listExpenses);
router.post('/expenses/:id/override', authenticateJWT, authorize('admin'), adminController.overrideExpense);

module.exports = router;
