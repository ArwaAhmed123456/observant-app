/**
 * Alert — notifications sent to managers (missed check calls, issues, incomplete patrols).
 * Also drives FCM push notification delivery.
 */
const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  siteId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  guardId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // Which manager(s) this alert belongs to
  managerIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  type: {
    type: String,
    enum: [
      'check_call_missed',
      'check_call_issue',
      'patrol_incomplete',
      'patrol_missing_checkpoints',
      'guard_booked_late',
      'shift_end_reminder',
      'random_prompt_ignored',
      'sos',
      'geofence_warning',
    ],
    required: true,
  },

  title:   { type: String, required: true },
  message: { type: String, required: true },
  note:    { type: String, default: null },

  // Reference to the source document
  refModel: { type: String, enum: ['CheckCall', 'PatrolSession', 'ShiftSession', 'RandomPromptLog'], default: null },
  refId:    { type: mongoose.Schema.Types.ObjectId, default: null },

  // Read tracking per manager
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // FCM delivery status
  pushSent:  { type: Boolean, default: false },
  pushSentAt:{ type: Date, default: null },
}, { timestamps: true });

alertSchema.index({ organisationId: 1, managerIds: 1, createdAt: -1 });
alertSchema.index({ siteId: 1, createdAt: -1 });

module.exports = mongoose.model('Alert', alertSchema);
