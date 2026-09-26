/**
 * AuditLog — immutable record of key system actions.
 * Written to on: account create/edit/deactivate, manual logs, SOS triggers, password resets.
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', default: null, index: true },
  actorId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  actorName:      { type: String, default: 'System' },
  actorRole:      { type: String, default: null },

  action: {
    type: String,
    required: true,
    enum: [
      'account_created', 'account_edited', 'account_deactivated', 'account_deleted',
      'password_reset_requested', 'password_reset_completed',
      'manual_log_check_call', 'manual_log_patrol',
      'sos_triggered', 'sos_resolved',
      'roster_published',
      'login', 'logout',
    ],
  },

  targetModel:  { type: String, default: null },   // e.g. 'User', 'CheckCall'
  targetId:     { type: mongoose.Schema.Types.ObjectId, default: null },
  targetName:   { type: String, default: null },   // human-readable label

  details:      { type: mongoose.Schema.Types.Mixed, default: null },
  ipAddress:    { type: String, default: null },
}, {
  timestamps: true,
  // Audit logs are never updated — enforce immutability at app level
});

auditLogSchema.index({ organisationId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
