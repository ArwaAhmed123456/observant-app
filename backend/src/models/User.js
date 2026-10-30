/**
 * User — guards and managers.
 * Scoped to an Organisation (tenant).
 */
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const notificationPreferencesSchema = new mongoose.Schema({
  exceptionOnly: { type: Boolean, default: false },
  routinePatrolPush: { type: Boolean, default: false },
  dailyPatrolEmailDigest: { type: Boolean, default: false },
  includePatrolPhotosInDigest: { type: Boolean, default: true },
  lastRoutineDigestAt: { type: Date, default: null },
  lastRoutineDigestAttemptAt: { type: Date, default: null },
}, { _id: false });

const userSchema = new mongoose.Schema({
  organisationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },

  name:        { type: String, required: true, trim: true },
  email:       { type: String, required: true, lowercase: true, trim: true },
  password:    { type: String, required: true, select: false },
  role:        { type: String, enum: ['guard', 'manager', 'admin', 'superadmin'], required: true },
  badgeNumber: { type: String, default: null },
  phone:       { type: String, default: null },
  avatarUrl:   { type: String, default: null },

  // siteId is retained as the primary/legacy site; guards may work at multiple sites.
  siteId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Site', default: null },
  assignedSiteIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Site' }],
  managedSiteIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Site' }],
  notificationPreferences: { type: notificationPreferencesSchema, default: () => ({}) },
  rosterWriteLockUntil: { type: Date, default: null, select: false },

  // Expo push token (field retained as fcmToken for backwards compatible schema)
  fcmToken:    { type: String, default: null },

  active:      { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null },

  // Refresh token store (hashed)
  refreshTokenHash: { type: String, default: null, select: false },
}, { timestamps: true });

// Compound unique index: email is unique per organisation
userSchema.index({ organisationId: 1, email: 1 }, { unique: true });

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare plain password
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
