// models/User.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin','manager','employee'], default: 'employee' },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  isEmailVerified: { type: Boolean, default: false },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isManagerApprover: { type: Boolean, default: false },
  refreshTokenHash: { type: String }, 
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
