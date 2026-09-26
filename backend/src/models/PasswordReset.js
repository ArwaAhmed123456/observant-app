/**
 * PasswordReset — short-lived code for email-based password reset.
 */
const mongoose = require('mongoose');
const crypto   = require('crypto');

const passwordResetSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  email:     { type: String, required: true },
  code:      { type: String, required: true },       // 6-digit code (hashed)
  expiresAt: { type: Date,   required: true },
  used:      { type: Boolean, default: false },
}, { timestamps: true });

// TTL index — MongoDB auto-deletes expired docs after 1 hour
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', passwordResetSchema);
