/**
 * User & Site management routes
 *
 * Users (manager/admin only unless guard reading own profile):
 * GET    /api/users              — list users in org
 * POST   /api/users              — create guard/manager
 * GET    /api/users/:id          — get user
 * PATCH  /api/users/:id          — update user
 * DELETE /api/users/:id          — deactivate user
 *
 * Sites:
 * GET    /api/sites              — list sites in org
 * POST   /api/sites              — create site
 * GET    /api/sites/:id          — get site
 * PATCH  /api/sites/:id          — update site
 * DELETE /api/sites/:id          — deactivate site
 */
const router = require('express').Router();
const { body, param } = require('express-validator');
const { User, Site }  = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate      = require('../middleware/validate');
const asyncHandler  = require('../utils/asyncHandler');
const { uploadAvatar, saveImage } = require('../services/mediaStore');
const { audit } = require('../utils/auditLogger');

function userCanAccessSite(user, siteId) {
  if (user.role === 'admin') return true;
  const id = String(siteId || '');
  if (user.role === 'guard') return String(user.siteId || '') === id;
  return (user.managedSiteIds || []).some(assigned => String(assigned) === id);
}

// ════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════

router.get('/users', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const { role, siteId, active = 'true' } = req.query;
    const filter = { organisationId: req.user.organisationId };
    if (role)   filter.role   = role;
    if (siteId) filter.siteId = siteId;
    if (req.user.role === 'manager') {
      filter.$or = [
        { siteId: { $in: req.user.managedSiteIds } },
        { managedSiteIds: { $in: req.user.managedSiteIds } },
      ];
    }
    if (active !== 'all') filter.active = active === 'true';

    const users = await User.find(filter).select('-password -refreshTokenHash').sort({ name: 1 });
    res.json({ users });
  })
);

router.post('/users',
  authenticate, requireRole('manager','admin'),
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 12 }),
    body('role').isIn(['guard','manager']),
    body('badgeNumber').optional().trim(),
    body('siteId').optional().isMongoId(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password, role, badgeNumber, siteId, managedSiteIds, phone } = req.body;
    if (role === 'guard' && !siteId) return res.status(400).json({ error: 'A guard account must be assigned to a site.' });
    if (siteId) {
      const site = await Site.findOne({ _id: siteId, organisationId: req.user.organisationId, active: true });
      if (!site) return res.status(400).json({ error: 'The selected site is not active in this organisation.' });
      if (req.user.role === 'manager' && !userCanAccessSite(req.user, siteId)) return res.status(403).json({ error: 'You cannot assign users outside your sites.' });
    }
    if (managedSiteIds?.length) {
      if (req.user.role === 'manager' && managedSiteIds.some(id => !userCanAccessSite(req.user, id))) return res.status(403).json({ error: 'You cannot assign managers outside your sites.' });
      const count = await Site.countDocuments({ _id: { $in: managedSiteIds }, organisationId: req.user.organisationId, active: true });
      if (count !== new Set(managedSiteIds.map(String)).size) return res.status(400).json({ error: 'One or more assigned manager sites are invalid.' });
    }

    const user = await User.create({
      organisationId: req.user.organisationId,
      name, email, password, role,
      badgeNumber:    badgeNumber || null,
      siteId:         siteId || null,
      managedSiteIds: managedSiteIds || [],
      phone:          phone || null,
    });

    const safe = user.toObject();
    delete safe.password;
    delete safe.refreshTokenHash;
    await audit({ req, action: 'account_created', targetModel: 'User', targetId: user._id, targetName: user.name });
    res.status(201).json({ user: safe });
  })
);

router.get('/users/:id', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id:            req.params.id,
    organisationId: req.user.organisationId,
  }).select('-password -refreshTokenHash');
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (req.user.role === 'guard' && String(user._id) !== String(req.user._id)) return res.status(403).json({ error: 'You can only view your own account.' });
  if (req.user.role === 'manager' && user.role !== 'admin') {
    const targetSiteIds = [user.siteId, ...(user.managedSiteIds || [])].filter(Boolean);
    if (!targetSiteIds.some(id => userCanAccessSite(req.user, id))) return res.status(403).json({ error: 'Account is outside your assigned sites.' });
  }
  res.json({ user });
}));

router.patch('/users/:id',
  authenticate, requireRole('manager','admin'),
  [body('role').optional().isIn(['guard','manager']), body('password').optional().isLength({ min: 12 })],
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, organisationId: req.user.organisationId }).select('+password +refreshTokenHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (req.user.role === 'manager' && user.role !== 'admin') {
      const targetSiteIds = [user.siteId, ...(user.managedSiteIds || [])].filter(Boolean).map(String);
      if (!targetSiteIds.some(id => req.user.managedSiteIds.map(String).includes(id))) {
        return res.status(403).json({ error: 'You cannot manage this account outside your assigned sites.' });
      }
    }
    if (user.role === 'admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Managers cannot edit administrator accounts.' });
    if (req.user.role === 'manager' && req.body.siteId && !userCanAccessSite(req.user, req.body.siteId)) return res.status(403).json({ error: 'You cannot assign users outside your sites.' });
    if (req.user.role === 'manager' && req.body.managedSiteIds?.some(id => !userCanAccessSite(req.user, id))) return res.status(403).json({ error: 'You cannot assign managers outside your sites.' });
    const allowed = ['name','phone','badgeNumber','siteId','managedSiteIds','active','avatarUrl','role'];
    allowed.forEach(key => { if (req.body[key] !== undefined) user[key] = req.body[key]; });
    if (req.body.password) {
      user.password = req.body.password;
      user.refreshTokenHash = null;
    }
    if (user.role === 'guard' && !user.siteId) return res.status(400).json({ error: 'A guard account must be assigned to a site.' });
    await user.save();
    await audit({ req, action: req.body.password ? 'password_changed' : 'account_edited', targetModel: 'User', targetId: user._id, targetName: user.name });
    const safe = user.toObject();
    delete safe.password;
    delete safe.refreshTokenHash;
    res.json({ user: safe });
  })
);

router.delete('/users/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, organisationId: req.user.organisationId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (req.user.role === 'manager' && user.role !== 'admin') {
      const targetSiteIds = [user.siteId, ...(user.managedSiteIds || [])].filter(Boolean);
      if (!targetSiteIds.some(id => userCanAccessSite(req.user, id))) return res.status(403).json({ error: 'Account is outside your assigned sites.' });
    }
    if (user.role === 'admin' && req.user.role !== 'admin') return res.status(403).json({ error: 'Managers cannot deactivate administrator accounts.' });
    user.active = false;
    await user.save();
    await audit({ req, action: 'account_deactivated', targetModel: 'User', targetId: user._id, targetName: user.name });
    res.json({ message: 'User deactivated' });
  })
);

// Upload avatar
router.post('/users/:id/avatar', authenticate, (req, res, next) => {
  uploadAvatar.single('avatar')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  if (req.user.role === 'guard' && String(req.user._id) !== req.params.id) return res.status(403).json({ error: 'You can only update your own avatar.' });
  const target = await User.findOne({ _id: req.params.id, organisationId: req.user.organisationId });
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (req.user.role === 'manager' && target.role !== 'admin') {
    const targetSiteIds = [target.siteId, ...(target.managedSiteIds || [])].filter(Boolean);
    if (!targetSiteIds.some(id => userCanAccessSite(req.user, id))) return res.status(403).json({ error: 'Account is outside your assigned sites.' });
  }
  const fileId = await saveImage(req.file, { organisationId: req.user.organisationId.toString(), userId: req.params.id, kind: 'avatar' });
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, organisationId: req.user.organisationId },
    { avatarUrl: `${req.protocol}://${req.get('host')}/api/media/${fileId}` },
    { new: true }
  ).select('-password -refreshTokenHash');
  res.json({ user });
}));

// ════════════════════════════════════════════════════════════
// SITES
// ════════════════════════════════════════════════════════════

router.get('/sites', authenticate, asyncHandler(async (req, res) => {
  const filter = { organisationId: req.user.organisationId, active: true };
  // Guards see only their site; managers see all their sites
  if (req.user.role === 'guard') {
    filter._id = req.user.siteId || null;
  } else if (req.user.role === 'manager') {
    filter._id = { $in: req.user.managedSiteIds };
  }
  const sites = await Site.find(filter).sort({ name: 1 });
  res.json({ sites });
}));

router.post('/sites',
  authenticate, requireRole('manager','admin'),
  [
    body('name').trim().notEmpty(),
    body('address').optional().trim(),
    body('managerId').optional().isMongoId(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, address, postcode, managerId: requestedManagerId, location, geofenceRadiusMetres, notes } = req.body;
    const managerId = requestedManagerId || (req.user.role === 'manager' ? req.user._id : null);
    if (!managerId) return res.status(400).json({ error: 'Select a manager for this site.' });
    if (req.user.role === 'manager' && String(managerId) !== String(req.user._id)) return res.status(403).json({ error: 'You may only create sites assigned to yourself.' });
    const manager = await User.findOne({ _id: managerId, organisationId: req.user.organisationId, role: 'manager', active: true });
    if (!manager) return res.status(400).json({ error: 'The selected site manager is not an active manager in this organisation.' });
    const site = await Site.create({
      organisationId: req.user.organisationId,
      managerId,
      name, address: address || null, postcode: postcode || null,
      location: location || undefined,
      geofenceRadiusMetres: geofenceRadiusMetres || 200,
      notes: notes || null,
    });
    await User.findByIdAndUpdate(managerId, { $addToSet: { managedSiteIds: site._id } });
    await audit({ req, action: 'site_created', targetModel: 'Site', targetId: site._id, targetName: site.name });
    res.status(201).json({ site });
  })
);

router.get('/sites/:id', authenticate, asyncHandler(async (req, res) => {
  const site = await Site.findOne({ _id: req.params.id, organisationId: req.user.organisationId });
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (!userCanAccessSite(req.user, site._id)) return res.status(403).json({ error: 'Site is outside your assigned area.' });
  res.json({ site });
}));

router.patch('/sites/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const allowed = ['name','address','postcode','location','geofenceRadiusMetres','notes','active','managerId'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (req.user.role === 'manager') {
      if (updates.managerId && String(updates.managerId) !== String(req.user._id)) return res.status(403).json({ error: 'You may only assign sites to yourself.' });
      if (!userCanAccessSite(req.user, req.params.id)) return res.status(403).json({ error: 'Site is outside your assigned area.' });
    }
    if (updates.managerId) {
      const assignedManager = await User.findOne({ _id: updates.managerId, organisationId: req.user.organisationId, role: 'manager', active: true });
      if (!assignedManager) return res.status(400).json({ error: 'The selected site manager is not active in this organisation.' });
    }
    const previous = await Site.findOne({ _id: req.params.id, organisationId: req.user.organisationId });
    if (!previous) return res.status(404).json({ error: 'Site not found' });
    const site = await Site.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId },
      updates, { new: true }
    );
    if (updates.managerId && String(previous.managerId) !== String(updates.managerId)) {
      await User.findByIdAndUpdate(previous.managerId, { $pull: { managedSiteIds: site._id } });
      await User.findByIdAndUpdate(updates.managerId, { $addToSet: { managedSiteIds: site._id } });
    }
    res.json({ site });
  })
);

router.delete('/sites/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    if (req.user.role === 'manager' && !userCanAccessSite(req.user, req.params.id)) return res.status(403).json({ error: 'Site is outside your assigned area.' });
    const site = await Site.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId },
      { active: false }, { new: true }
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json({ message: 'Site deactivated' });
  })
);

module.exports = router;
