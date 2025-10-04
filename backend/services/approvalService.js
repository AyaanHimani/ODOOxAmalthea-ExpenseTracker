// services/approvalService.js
const Expense = require('../models/Expense');
const Company = require('../models/Company');
const User = require('../models/User');

/**
 * Utility: find current approvers for the expense based on flow step
 */
async function getCurrentApprovers(expense) {
  const company = await Company.findById(expense.company).lean();
  if (!company) throw new Error('Company not found');

  const flow = (company.approvalFlows || []).find(f => f.name === expense.approvalFlowName && f.active);
  if (!flow) return [];

  const currentStep = flow.steps.find(s => s.level === expense.currentStepIndex + 1);
  if (!currentStep) return [];

  // Resolve approvers:
  if (currentStep.approvers && currentStep.approvers.length > 0) {
    return currentStep.approvers.map(a => a.toString());
  }

  // If role-based step (like manager, finance, director)
  if (currentStep.role === 'manager') {
    const submitter = await User.findById(expense.submittedBy);
    if (submitter?.manager) return [submitter.manager.toString()];
  }

  // Role-based general approvers
  const users = await User.find({ company: expense.company, role: currentStep.role }).select('_id');
  return users.map(u => u._id.toString());
}

/**
 * Check if user is a current approver for this expense
 */
async function isUserCurrentApprover(expense, userId) {
  const approvers = await getCurrentApprovers(expense);
  return approvers.includes(userId.toString());
}

/**
 * Handle approval / rejection
 * - Move to next step if all current approvers approve
 * - Apply conditional rules if defined
 * - Mark expense as approved/rejected
 */
async function handleApproval({ expenseId, approverId, decision, comments }) {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw { status: 404, message: 'Expense not found' };
  if (expense.status !== 'pending') throw { status: 400, message: 'Expense already processed' };

  const company = await Company.findById(expense.company).lean();
  if (!company) throw { status: 404, message: 'Company not found' };

  const flow = (company.approvalFlows || []).find(f => f.name === expense.approvalFlowName && f.active);
  if (!flow) throw { status: 400, message: 'No approval flow configured for this expense; admin override required' };

  const currentStep = flow.steps[expense.currentStepIndex];
  if (!currentStep) throw { status: 400, message: 'Invalid step index' };

  // Record decision
  expense.approvalHistory.push({
    approver: approverId,
    decision,
    comments,
    decidedAt: new Date(),
    stepIndex: expense.currentStepIndex
  });

  // Handle rejection immediately
  if (decision === 'rejected') {
    expense.status = 'rejected';
    await expense.save();
    return { expense, message: 'Expense rejected and closed' };
  }

  // If approved — check if we can move forward
  const stepApprovers = await getCurrentApprovers(expense);
  const approvedIds = expense.approvalHistory
    .filter(h => h.stepIndex === expense.currentStepIndex && h.decision === 'approved')
    .map(h => h.approver.toString());

  // Check conditional rule (if any)
  if (flow.rule && flow.rule.enabled) {
    const rule = flow.rule;
    if (rule.type === 'percentage' && rule.percentageThreshold) {
      const ratio = (approvedIds.length / stepApprovers.length) * 100;
      if (ratio >= rule.percentageThreshold) {
        expense.currentStepIndex += 1;
      } else {
        await expense.save();
        return { expense, message: `Approved (${ratio.toFixed(0)}% so far)` };
      }
    } else if (rule.type === 'specific' && rule.specificApprover) {
      if (approvedIds.includes(rule.specificApprover.toString())) {
        expense.currentStepIndex += 1;
      } else {
        await expense.save();
        return { expense, message: 'Waiting for specific approver' };
      }
    } else if (rule.type === 'hybrid') {
      const ratio = (approvedIds.length / stepApprovers.length) * 100;
      const percentOK = rule.percentageThreshold && ratio >= rule.percentageThreshold;
      const specificOK = rule.specificApprover && approvedIds.includes(rule.specificApprover.toString());
      if (percentOK || specificOK) {
        expense.currentStepIndex += 1;
      } else {
        await expense.save();
        return { expense, message: 'Hybrid rule waiting' };
      }
    }
  } else {
    // Default: if all approvers of current step approved
    const allApproved = stepApprovers.every(id => approvedIds.includes(id));
    if (allApproved) expense.currentStepIndex += 1;
  }

  // Move to next step or finalize
  const nextStep = flow.steps[expense.currentStepIndex];
  if (!nextStep) {
    expense.status = 'approved';
  } else {
    expense.status = 'pending';
  }

  await expense.save();
  return { expense, message: `Decision recorded and ${expense.status}` };
}

module.exports = {
  getCurrentApprovers,
  isUserCurrentApprover,
  handleApproval
};
