/**
 * CheckCall — one check call event within a shift session.
 */
const mongoose = require('mongoose');

const checkCallSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  sessionId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftSession', required: true },
  guardId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  siteId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },

  firedAt:     { type: Date, required: true, default: Date.now },
  expiresAt:   { type: Date, required: true },  // firedAt + 10 min window

  respondedAt: { type: Date, default: null },
  response:    { type: String, enum: ['yes', 'no', 'missed', null], default: null },
  note:        { type: String, default: null, maxlength: 500 },

  isRandom:        { type: Boolean, default: false },
  managerAlerted:  { type: Boolean, default: false },
  managerAlertedAt:{ type: Date, default: null },
}, { timestamps: true });

checkCallSchema.index({ organisationId: 1, guardId: 1, firedAt: -1 });
checkCallSchema.index({ sessionId: 1, firedAt: 1 });
// TTL-like query support: find unanswered calls past expiry
checkCallSchema.index({ response: 1, expiresAt: 1 });

module.exports = mongoose.model('CheckCall', checkCallSchema);
