// models/Company.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const CurrencySchema = new Schema({
  code: { type: String, required: true },
  name: { type: String, default: '' },
  symbol: { type: String, default: '' }
}, { _id: false });

const ApprovalStepSchema = new Schema({
  level: Number,
  role: String,
  approvers: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { _id: false });

const ApprovalRuleSchema = new Schema({
  name: String,
  type: { type: String, enum: ['percentage','specific','hybrid'], required: true },
  percentageThreshold: Number,
  specificApprover: { type: Schema.Types.ObjectId, ref: 'User' },
  description: String,
  enabled: { type: Boolean, default: true }
}, { _id: false });

const ApprovalFlowSchema = new Schema({
  name: String,
  description: String,
  steps: [ApprovalStepSchema],
  rule: ApprovalRuleSchema,
  isDefault: { type: Boolean, default: false },
  active: { type: Boolean, default: true }
}, { _id: false });

const CompanySchema = new Schema({
  name: { type: String, required: true },
  country: { type: String, required: true },
  currency: { type: CurrencySchema, required: true },
  approvalFlows: { type: [ApprovalFlowSchema], default: [] },
  approvalRules: { type: [ApprovalRuleSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('Company', CompanySchema);
