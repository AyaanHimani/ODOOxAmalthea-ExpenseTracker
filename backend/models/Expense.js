// models/Expense.js
const mongoose = require('mongoose');
const { Schema, model, Types } = mongoose;

const ExpenseSchema = new Schema({
  company: { type: Types.ObjectId, ref: 'Company', required: true, index: true },
  submittedBy: { type: Types.ObjectId, ref: 'User', required: true, index: true },

  amountOriginal: { type: Number, required: true },
  currencyOriginal: { type: String, required: true },
  amountBase: { type: Number, required: true },
  baseCurrency: { type: String, required: true },

  category: { type: String, index: true },
  description: { type: String, default: '' },
  expenseDate: { type: Date, required: true },

  // attachments embedded
  attachments: [{
    filename: { type: String },
    url: { type: String },
    contentType: { type: String },
    uploadedBy: { type: Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date }
  }],

  // OCR results embedded
  ocr: {
    merchant: { type: String },
    detectedAmount: { type: Number },
    detectedDate: { type: Date },
    rawText: { type: String }
  },

  // embedded approval history (ordered)
  approvalHistory: [{
    approver: { type: Types.ObjectId, ref: 'User' },
    decision: { type: String, enum: ['approved', 'rejected', 'escalated'] },
    comments: { type: String },
    decidedAt: { type: Date },
    stepIndex: { type: Number }
  }],

  // flow pointers
  approvalFlowName: { type: String, default: '' },    // if flows are in Company, reference by name
  currentStepIndex: { type: Number, default: 0 },

  status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
  flagged: { type: Boolean, default: false },
  flaggedReason: { type: String, default: '' }
}, { timestamps: true });

ExpenseSchema.index({ company: 1, status: 1, createdAt: -1 });

module.exports = model('Expense', ExpenseSchema);
