/**
 * PatrolCheckpoint — site-level config: list of points a guard must photograph.
 */
const mongoose = require('mongoose');

const patrolCheckpointSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  siteId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },

  name:     { type: String, required: true, trim: true },
  order:    { type: Number, required: true, default: 1 },
  required: { type: Boolean, default: true },
  active:   { type: Boolean, default: true },

  // Optional QR/NFC code to scan at this checkpoint
  qrCode:   { type: String, default: null },

  // Optional GPS coords of this checkpoint
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
}, { timestamps: true });

patrolCheckpointSchema.index({ siteId: 1, order: 1 });

module.exports = mongoose.model('PatrolCheckpoint', patrolCheckpointSchema);
