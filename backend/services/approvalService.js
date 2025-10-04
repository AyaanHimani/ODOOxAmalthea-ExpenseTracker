// services/approvalService.js
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const Company = require('../models/Company');
const User = require('../models/User');

/**
 * Resolve the flow used for an expense.
 * - If expense.approvalFlowName present, find company.defaultApprovalFlows by name
 * - Otherwise return company's default flow (isDefault === true) or first flow
 */
async function getFlowForExpense(expense) {
  const company = await Company.findById(expense.company).lean();
  if (!company) throw new Error('Company not found');

  const flows = company.defaultApprovalFlows || [];
  if (expense.approvalFlowName) {
    const f = flows.find(ff => String(ff.name) === String(expense.approvalFlowName));
    if (f) return { flow: f, company };
  }
  const defaultFlow = flows.find(ff => ff.isDefault) || flows[0] || null;
  return { flow: defaultFlow, company };
}

/**
 * Resolve approver userIds for a given step definition and expense.
 * step: { type: 'manager'|'role'|'user'|'group', value: ... , requireAll: boolean }
 */
async function resolveApproversForStep(step, expense) {
  if (!step) return [];

  const companyId = expense.company;
  if (step.type === 'manager') {
    // use submittedBy.manager
    const submitter = await User.findById(expense.submittedBy).lean();
    if (!submitter || !submitter.manager) return [];
    // manager could be an ObjectId or string
    return [String(submitter.manager)];
  }

  if (step.type === 'user') {
    // value is a single userId
    return [String(step.value)].filter(Boolean);
  }

  if (step.type === 'group') {
    // value is expected to be array of userIds
    if (Array.isArray(step.value)) return step.value.map(String);
    return [];
  }

  if (step.type === 'role') {
    // value is role name (e.g., 'finance' or 'director' or 'manager')
    // find all users in company with role === value and is active
    const users = await User.find({ company: companyId, role: step.value }).select('_id').lean();
    return users.map(u => String(u._id));
  }

  // unknown type -> empty
  return [];
}

/**
 * Get current approver IDs for expense (array)
 */
async function getCurrentApproverIds(expense) {
  const { flow } = await getFlowForExpense(expense);
  if (!flow) return []; // no flow configured -> no approvers

  const steps = flow.steps || [];
  const idx = expense.currentStepIndex || 0;
  if (idx >= steps.length) return []; // flow finished

  const step = steps[idx];
  const approvers = await resolveApproversForStep(step, expense);
  return approvers;
}

/**
 * Check whether a user is among current approvers for an expense
 */
async function isUserCurrentApprover(expense, userId) {
  const approvers = await getCurrentApproverIds(expense);
  return approvers.map(String).includes(String(userId));
}

/**
 * Helper: find rule object from company by id or inline rule object in flow.
 * Rule types: percentage (percentageThreshold), specific (specificApprover), hybrid (combine)
 */
function evaluateSpecificApproverRule(rule, approvalHistory) {
  if (!rule || rule.type !== 'specific') return false;
  const target = String(rule.specificApprover);
  return approvalHistory.some(a => String(a.approver) === target && a.decision === 'approved');
}

function evaluatePercentageRule(rule, currentStepApprovers, approvalHistory) {
  if (!rule || rule.type !== 'percentage') return false;
  const threshold = rule.percentageThreshold || 100;
  if (!currentStepApprovers || currentStepApprovers.length === 0) return false;
  // count approvals in this step
  const stepIndex = approvalHistory.length ? approvalHistory[approvalHistory.length - 1].stepIndex : null;
  // Instead compute approvals for current step index:
  const approvalsForStep = approvalHistory.filter(a => a.stepIndex === null || a.stepIndex === undefined ? true : a.stepIndex === null ? false : a.stepIndex === null ? false : a.stepIndex === a.stepIndex).length;
  // Simpler: count approvals among approvalHistory where approver in currentStepApprovers
  const approvals = approvalHistory.filter(a => a.decision === 'approved' && currentStepApprovers.map(String).includes(String(a.approver))).length;
  const percent = (approvals / currentStepApprovers.length) * 100;
  return percent >= threshold;
}

/**
 * A more robust percentage evaluator: count approvals for current step by stepIndex.
 */
function evaluatePercentageRuleByStep(rule, currentStepIndex, currentStepApprovers, approvalHistory) {
  if (!rule || rule.type !== 'percentage') return false;
  const threshold = rule.percentageThreshold || 100;
  if (!currentStepApprovers || currentStepApprovers.length === 0) return false;
  const approvals = approvalHistory.filter(a => a.decision === 'approved' && Number(a.stepIndex) === Number(currentStepIndex) && currentStepApprovers.map(String).includes(String(a.approver))).length;
  const percent = (approvals / currentStepApprovers.length) * 100;
  return percent >= threshold;
}

/**
 * Process an approval / rejection by an approver for an expense
 * Params: { expenseId, approverId, decision: 'approved'|'rejected'|'escalated', comments }
 * Returns { expense, action: 'advanced'|'finalized'|'rejected'|'escalated', nextApprovers: [] }
 */
async function handleApproval({ expenseId, approverId, decision = 'approved', comments = '' }) {
  if (!mongoose.isValidObjectId(expenseId)) throw new Error('Invalid expense id');
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new Error('Expense not found');

  // ensure approver is allowed
  const isCurrent = await isUserCurrentApprover(expense, approverId);
  if (!isCurrent) {
    // allow admin override via separate admin endpoint; here reject
    throw { status: 403, message: 'User not authorized to approve at this step' };
  }

  // Append approval record
  const stepIndex = expense.currentStepIndex || 0;
  expense.approvalHistory.push({
    approver: approverId,
    roleAtApproval: '', // optional: you can fill role by fetching user
    decision,
    comments,
    decidedAt: new Date(),
    stepIndex
  });

  // If decision is rejected -> finalize rejected immediately
  if (decision === 'rejected') {
    expense.status = 'rejected';
    await expense.save();
    return { expense, action: 'rejected', nextApprovers: [] };
  }

  // decision === 'approved' or 'escalated'
  // Load flow & company rules
  const { flow, company } = await getFlowForExpense(expense);
  const currIdx = expense.currentStepIndex || 0;
  const steps = (flow && flow.steps) || [];
  const currentStep = steps[currIdx];

  // Resolve current step approvers
  const currentApprovers = await resolveApproversForStep(currentStep, expense);

  // Look up rule: flow.rule may be an id referencing company.approvalRules, or an inline object
  let rule = null;
  if (flow && flow.rule) {
    // if it's an object with type present -> inline
    if (flow.rule.type) {
      rule = flow.rule;
    } else {
      // assume it is an ObjectId -> find in company.approvalRules
      rule = (company.approvalRules || []).find(r => String(r._id) === String(flow.rule)) || null;
    }
  }

  // Evaluate specific approver rule: if satisfied -> finalize
  if (rule && (rule.type === 'specific' || rule.type === 'hybrid') && rule.specificApprover) {
    const specificOk = evaluateSpecificApproverRule(rule, expense.approvalHistory);
    if (specificOk) {
      expense.status = 'approved';
      await expense.save();
      return { expense, action: 'finalized', nextApprovers: [] };
    }
  }

  // Evaluate percentage rule for the current step:
  if (rule && (rule.type === 'percentage' || rule.type === 'hybrid') && rule.percentageThreshold) {
    const percentOk = evaluatePercentageRuleByStep(rule, currIdx, currentApprovers, expense.approvalHistory);
    if (percentOk) {
      // If this is the last step, finalize approved
      if (currIdx >= steps.length - 1) {
        expense.status = 'approved';
        await expense.save();
        return { expense, action: 'finalized', nextApprovers: [] };
      } else {
        // advance to next step
        expense.currentStepIndex = currIdx + 1;
        await expense.save();
        const nextApprovers = await getCurrentApproverIds(expense);
        return { expense, action: 'advanced', nextApprovers };
      }
    }
  }

  // Default sequencing: if all required approvers for the step have approved, advance.
  // If step.requireAll === true, ensure every approver in currentApprovers has an approval record at this step.
  if (currentStep && currentStep.requireAll) {
    const approvalsAtThisStep = expense.approvalHistory.filter(a => Number(a.stepIndex) === Number(currIdx) && a.decision === 'approved').map(a => String(a.approver));
    const uniqueApprovals = [...new Set(approvalsAtThisStep)];
    const allApproved = currentApprovers.every(id => uniqueApprovals.includes(String(id)));
    if (allApproved) {
      if (currIdx >= steps.length - 1) {
        expense.status = 'approved';
        await expense.save();
        return { expense, action: 'finalized', nextApprovers: [] };
      } else {
        expense.currentStepIndex = currIdx + 1;
        await expense.save();
        const nextApprovers = await getCurrentApproverIds(expense);
        return { expense, action: 'advanced', nextApprovers };
      }
    } else {
      // not yet all approved, keep pending
      await expense.save();
      return { expense, action: 'pending', nextApprovers: [] };
    }
  } else {
    // requireAll === false or unspecified -> any single approver suffices: advance to next step
    if (currIdx >= steps.length - 1) {
      expense.status = 'approved';
      await expense.save();
      return { expense, action: 'finalized', nextApprovers: [] };
    } else {
      expense.currentStepIndex = currIdx + 1;
      await expense.save();
      const nextApprovers = await getCurrentApproverIds(expense);
      return { expense, action: 'advanced', nextApprovers };
    }
  }
}

module.exports = {
  getCurrentApproverIds,
  isUserCurrentApprover,
  handleApproval
};
