/**
 * ShiftSession — one guard's live shift (book on → book off).
 */
const mongoose = require('mongoose');

const shiftSessionSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  guardId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  siteId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  rosterId:       { type: mongoose.Schema.Types.ObjectId, ref: 'ShiftRoster', default: null },

  bookedOnAt:  { type: Date, required: true, default: Date.now },
  bookedOffAt: { type: Date, default: null },

  // Scheduled times from the roster (snapshot at book-on time)
  scheduledStart: { type: String, default: null }, // HH:MM
  scheduledEnd:   { type: String, default: null },

  // How on-time was the guard?
  punctuality: {
    type: String,
    enum: ['on_time', 'slightly_late', 'late', 'early', 'unscheduled'],
    default: 'unscheduled',
  },
  punctualityMinutes: { type: Number, default: 0 },

  // Running counters (updated on each event)
  checkCallCount:       { type: Number, default: 0 },
  missedCheckCallCount: { type: Number, default: 0 },
  patrolCount:          { type: Number, default: 0 },

  autoEnded: { type: Boolean, default: false }, // true if system closed a stale session
}, { timestamps: true });

shiftSessionSchema.index({ organisationId: 1, guardId: 1, bookedOnAt: -1 });
shiftSessionSchema.index({ organisationId: 1, siteId: 1, bookedOnAt: -1 });

module.exports = mongoose.model('ShiftSession', shiftSessionSchema);
