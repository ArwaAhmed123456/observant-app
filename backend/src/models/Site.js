/**
 * Site — a physical location managed by an Organisation.
 */
const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  managerId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  name:        { type: String, required: true, trim: true },
  address:     { type: String, default: null },
  postcode:    { type: String, default: null },

  // Optional geo-fence centre point [lng, lat]
  location: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
  },
  geofenceRadiusMetres: { type: Number, default: 200 },

  active:  { type: Boolean, default: true },
  notes:   { type: String, default: null },
}, { timestamps: true });

siteSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Site', siteSchema);
