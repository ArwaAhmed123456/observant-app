/**
 * CheckCall — one check call event within a shift session.
 */
const mongoose = require('mongoose');

const checkCallSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  sessionId:      { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftSession', default: null },
  guardId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  siteId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },

  firedAt:     { type: Date, required: true, default: Date.now },
  scheduledFor:{ type: Date, default: null },
  expiresAt:   { type: Date, required: true },  // firedAt + 10 min window

  respondedAt: { type: Date, default: null },
  response:    { type: String, enum: ['yes', 'no', 'missed', null], default: null },
  note:        { type: String, default: null, maxlength: 500 },
  category:    { type: String, default: null, maxlength: 100 },
  photoUrl:    { type: String, default: null },
  isManualLog: { type: Boolean, default: false },
  manuallyLoggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  isRandom:        { type: Boolean, default: false },
  managerAlerted:  { type: Boolean, default: false },
  managerAlertedAt:{ type: Date, default: null },
}, { timestamps: true });

checkCallSchema.index({ organisationId: 1, guardId: 1, firedAt: -1 });
checkCallSchema.index({ sessionId: 1, firedAt: 1 });
// TTL-like query support: find unanswered calls past expiry
checkCallSchema.index({ response: 1, expiresAt: 1 });
checkCallSchema.index(
  { sessionId: 1, scheduledFor: 1 },
  { unique: true, partialFilterExpression: { scheduledFor: { $type: 'date' } } }
);

module.exports = mongoose.model('CheckCall', checkCallSchema);
