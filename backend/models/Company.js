// models/Company.js
const mongoose = require('mongoose');

const CompanySchema = new mongoose.Schema({
  companyName: { type: String, required: true, unique: true },
  country: { type: String },
  currency: {
    code: { type: String },
    symbol: { type: String },
    name: { type: String }
  },
  baseCurrency: { type: String }, // e.g., "INR"
  createdAt: { type: Date, default: Date.now },
  defaultApprovalFlow: {
  name: String,
  steps: [{
    type: { type: String, enum: ['role','user','manager'], required: true },
    value: mongoose.Schema.Types.Mixed, // role name or userId
    requireAll: { type: Boolean, default: true },
    minAmount: { type: Number, default: 0 }
  }],
  // rule inside flow
  rule: {
    type: { type: String, enum: ['percentage','specific','none'], default: 'none' },
    percentageThreshold: Number,
    specificApprover: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }
}
}, { timestamps: true });

module.exports = mongoose.model('Company', CompanySchema);
