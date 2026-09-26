/**
 * Organisation (tenant root)
 * Every other document references an organisationId for full multi-tenant isolation.
 */
const mongoose = require('mongoose');

const organisationSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  logoUrl:     { type: String, default: null },
  contactEmail:{ type: String, required: true, lowercase: true, trim: true },
  contactPhone:{ type: String, default: null },
  address:     { type: String, default: null },
  plan:        { type: String, enum: ['trial', 'basic', 'pro', 'enterprise'], default: 'trial' },
  active:      { type: Boolean, default: true },
  settings: {
    checkCallIntervalMinutes: { type: Number, default: 60 },
    checkCallWindowMinutes:   { type: Number, default: 10 },
    patrolIntervalMinutes:    { type: Number, default: 60 },
    antiIdleMinMinutes:       { type: Number, default: 30 },
    shiftEndWarnMinutes:      { type: Number, default: 10 },
  },
}, { timestamps: true });

module.exports = mongoose.model('Organisation', organisationSchema);
