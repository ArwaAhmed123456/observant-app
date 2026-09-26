/**
 * PatrolSession — one patrol run by a guard.
 * Embeds checkpoint captures so we don't need a separate join for the common case.
 */
const mongoose = require('mongoose');

const captureSchema = new mongoose.Schema({
  checkpointId: { type: mongoose.Schema.Types.ObjectId, ref: 'PatrolCheckpoint', required: true },
  photoUrl:     { type: String, required: true },    // Cloudinary URL
  publicId:     { type: String, required: true },    // Cloudinary public_id (for deletion)
  capturedAt:   { type: Date, default: Date.now },
  latitude:     { type: Number, default: null },
  longitude:    { type: Number, default: null },
}, { _id: true });

const patrolSessionSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  shiftSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftSession', required: true },
  guardId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  siteId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },

  startedAt:  { type: Date, required: true, default: Date.now },
  finishedAt: { type: Date, default: null },

  // IDs of checkpoints that were captured
  capturedCheckpointIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'PatrolCheckpoint' }],
  // IDs of required checkpoints that were NOT captured on finish
  missingCheckpointIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'PatrolCheckpoint' }],

  captures: [captureSchema],

  status: {
    type: String,
    enum: ['in_progress', 'complete', 'incomplete', 'abandoned'],
    default: 'in_progress',
  },

  // Was manager alerted about missing checkpoints?
  managerAlerted:   { type: Boolean, default: false },
  triggeredByAntiIdle: { type: Boolean, default: false },
}, { timestamps: true });

patrolSessionSchema.index({ organisationId: 1, guardId: 1, startedAt: -1 });
patrolSessionSchema.index({ shiftSessionId: 1 });

module.exports = mongoose.model('PatrolSession', patrolSessionSchema);
