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
const { uploadAvatar } = require('../services/cloudinary');

// ════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════

router.get('/users', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const { role, siteId, active = 'true' } = req.query;
    const filter = { organisationId: req.user.organisationId };
    if (role)   filter.role   = role;
    if (siteId) filter.siteId = siteId;
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
    body('password').isLength({ min: 8 }),
    body('role').isIn(['guard','manager']),
    body('badgeNumber').optional().trim(),
    body('siteId').optional().isMongoId(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, password, role, badgeNumber, siteId, managedSiteIds, phone } = req.body;

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
    res.status(201).json({ user: safe });
  })
);

router.get('/users/:id', authenticate, asyncHandler(async (req, res) => {
  const user = await User.findOne({
    _id:            req.params.id,
    organisationId: req.user.organisationId,
  }).select('-password -refreshTokenHash');
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
}));

router.patch('/users/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const allowed = ['name','phone','badgeNumber','siteId','managedSiteIds','active','avatarUrl'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId },
      updates,
      { new: true }
    ).select('-password -refreshTokenHash');

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  })
);

router.delete('/users/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    await User.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId },
      { active: false }
    );
    res.json({ message: 'User deactivated' });
  })
);

// Upload avatar
router.post('/users/:id/avatar', authenticate, (req, res, next) => {
  uploadAvatar(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, organisationId: req.user.organisationId },
    { avatarUrl: req.file.path },
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
  if (req.user.role === 'guard' && req.user.siteId) {
    filter._id = req.user.siteId;
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
    body('managerId').isMongoId(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, address, postcode, managerId, location, geofenceRadiusMetres, notes } = req.body;
    const site = await Site.create({
      organisationId: req.user.organisationId,
      managerId,
      name, address: address || null, postcode: postcode || null,
      location: location || undefined,
      geofenceRadiusMetres: geofenceRadiusMetres || 200,
      notes: notes || null,
    });
    res.status(201).json({ site });
  })
);

router.get('/sites/:id', authenticate, asyncHandler(async (req, res) => {
  const site = await Site.findOne({ _id: req.params.id, organisationId: req.user.organisationId });
  if (!site) return res.status(404).json({ error: 'Site not found' });
  res.json({ site });
}));

router.patch('/sites/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const allowed = ['name','address','postcode','location','geofenceRadiusMetres','notes','active','managerId'];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    const site = await Site.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId },
      updates, { new: true }
    );
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json({ site });
  })
);

router.delete('/sites/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    await Site.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId },
      { active: false }
    );
    res.json({ message: 'Site deactivated' });
  })
);

module.exports = router;
