/**
 * RosterTemplate — saved roster pattern a manager can reuse.
 */
const mongoose = require('mongoose');

const rosterTemplateSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  name:    { type: String, required: true, trim: true },
  // Optionally linked to a guard (personal template) or null (generic)
  guardId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  days: {
    mon: { start: String, end: String },
    tue: { start: String, end: String },
    wed: { start: String, end: String },
    thu: { start: String, end: String },
    fri: { start: String, end: String },
    sat: { start: String, end: String },
    sun: { start: String, end: String },
  },
}, { timestamps: true });

module.exports = mongoose.model('RosterTemplate', rosterTemplateSchema);
