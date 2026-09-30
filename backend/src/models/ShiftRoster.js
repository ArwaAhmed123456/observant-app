/**
 * ShiftRoster — weekly schedule for one guard.
 * weekStartDate = ISO date string of that week's Monday (YYYY-MM-DD).
 * days = map of day keys to shift times.
 */
const mongoose = require('mongoose');

const dayShiftSchema = new mongoose.Schema({
  start: { type: String, required: true }, // HH:MM
  end:   { type: String, required: true }, // HH:MM
}, { _id: false });

const shiftRosterSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  guardId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  siteId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
  // Optional site checkpoints assigned to this guard for the roster week.
  checkpointIds:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'PatrolCheckpoint' }],
  publishedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  weekStartDate:  { type: String, required: true }, // e.g. "2026-09-21"

  days: {
    mon: { type: dayShiftSchema, default: null },
    tue: { type: dayShiftSchema, default: null },
    wed: { type: dayShiftSchema, default: null },
    thu: { type: dayShiftSchema, default: null },
    fri: { type: dayShiftSchema, default: null },
    sat: { type: dayShiftSchema, default: null },
    sun: { type: dayShiftSchema, default: null },
  },

  notifiedAt:  { type: Date, default: null },   // when push was sent to guard
  publishedAt: { type: Date, default: Date.now },
}, { timestamps: true });

// One roster per guard per week
shiftRosterSchema.index({ organisationId: 1, guardId: 1, weekStartDate: 1 }, { unique: true });

module.exports = mongoose.model('ShiftRoster', shiftRosterSchema);
