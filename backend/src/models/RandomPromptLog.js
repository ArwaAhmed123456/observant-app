/**
 * RandomPromptLog — records each anti-idle surprise patrol prompt.
 * Lets managers see patterns of ignored prompts.
 */
const mongoose = require('mongoose');

const randomPromptLogSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  shiftSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftSession', required: true },
  guardId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  siteId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },

  triggeredAt:  { type: Date, required: true, default: Date.now },
  responded:    { type: Boolean, default: false },
  respondedAt:  { type: Date, default: null },
  managerAlerted: { type: Boolean, default: false },
  expiresAt: { type: Date, default: null },

  // If guard responded, link to the patrol they started
  patrolSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatrolSession', default: null },
}, { timestamps: true });

randomPromptLogSchema.index({ organisationId: 1, guardId: 1, triggeredAt: -1 });

module.exports = mongoose.model('RandomPromptLog', randomPromptLogSchema);
