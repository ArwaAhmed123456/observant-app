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
const { User, Site, ShiftRoster, Alert }  = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate      = require('../middleware/validate');
const asyncHandler  = require('../utils/asyncHandler');
const { uploadAvatar, saveImage } = require('../services/mediaStore');
const { audit } = require('../utils/auditLogger');
const {
  isValidWhat3Words,
  normalizeW3W,
  getCoordinatesFromWhat3Words,
  getWhat3WordsFromCoordinates,
} = require('../utils/what3words');

function userCanAccessSite(user, siteId) {
  if (user.role === 'admin') return true;
  const id = String(siteId || '');
  if (user.role === 'guard') return [user.siteId, ...(user.assignedSiteIds || [])].some(assigned => String(assigned || '') === id);
  return (user.managedSiteIds || []).some(assigned => String(assigned) === id);
}

async function getManagerSiteIds(user) {
  const ownedSiteIds = await Site.find({
    organisationId: user.organisationId,
    managerId: user._id,
    active: true,
  }).distinct('_id');
  return [...new Set([...(user.managedSiteIds || []), ...ownedSiteIds].map(String))];
}

// ════════════════════════════════════════════════════════════
// USERS
// ════════════════════════════════════════════════════════════

router.patch('/users/me/notification-preferences', authenticate, requireRole('manager','admin'), asyncHandler(async (req, res) => {
  const allowed = ['exceptionOnly', 'routinePatrolPush', 'dailyPatrolEmailDigest', 'includePatrolPhotosInDigest'];
  const updates = {};
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    if (typeof req.body[key] !== 'boolean') return res.status(400).json({ error: `${key} must be true or false.` });
    updates[`notificationPreferences.${key}`] = req.body[key];
  }
  const user = await User.findOneAndUpdate(
    { _id: req.user._id, organisationId: req.user.organisationId },
    { $set: updates },
    { new: true }
  ).select('-password -refreshTokenHash');
  if (!user) return res.status(404).json({ error: 'Manager account not found.' });
  res.json({
    notificationPreferences: user.notificationPreferences,
    emailDeliveryConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM),
  });
}));

router.get('/users', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const { role, siteId, active = 'true' } = req.query;
    const filter = { organisationId: req.user.organisationId };
    if (role)   filter.role   = role;
    if (siteId) filter.$and = [{ $or: [{ siteId }, { assignedSiteIds: siteId }] }];
    if (req.user.role === 'manager') {
      const managerSiteIds = await getManagerSiteIds(req.user);
      filter.$and = [...(filter.$and || []), { $or: [
        { siteId: { $in: managerSiteIds } },
        { assignedSiteIds: { $in: managerSiteIds } },
        { managedSiteIds: { $in: managerSiteIds } },
      ] }];
    }
    if (active !== 'all') filter.active = active === 'true';

    const users = await User.find(filter).select('-password -refreshTokenHash').sort({ name: 1 });
    res.json({ users });
  })
);

router.post('/users',
  authenticate, requireRole('manager','admin','superadmin'),
  [
    body('name').trim().notEmpty(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('role').isIn(['guard','manager','admin','superadmin']),
    body('badgeNumber').optional().trim(),
    body('siteId').optional(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    let { name, email, password, role, badgeNumber, siteId, assignedSiteIds = [], managedSiteIds, phone } = req.body;
    if (!Array.isArray(assignedSiteIds)) return res.status(400).json({ error: 'Choose one or more valid sites for this guard.' });
    assignedSiteIds = [...new Set(assignedSiteIds.map(id => String(id || '').trim()).filter(Boolean))];
    if (siteId && typeof siteId === 'object') siteId = String(siteId._id || siteId.id || '');
    if (req.user.role === 'manager' && !['guard', 'manager'].includes(role)) {
      return res.status(403).json({ error: 'Managers can only create guard or manager accounts.' });
    }
    if (siteId === '' || siteId === undefined) siteId = null;
    if (role === 'guard' && !siteId && !assignedSiteIds.length) {
      // If no site provided, auto-assign to first active site in organisation if available
      const firstSite = await Site.findOne({ organisationId: req.user.organisationId, active: true });
      if (firstSite) siteId = firstSite._id;
      else return res.status(400).json({ error: 'A guard account must be assigned to a site. Please create a site first.' });
    }
    const existingEmail = await User.findOne({ organisationId: req.user.organisationId, email: String(email).trim().toLowerCase() }).select('_id active');
    if (existingEmail) return res.status(409).json({ error: existingEmail.active === false ? 'This email already belongs to an inactive account. Reactivate that account or use a different email address.' : 'An account with this email already exists in your organisation.' });
    if (role === 'guard') {
      assignedSiteIds = [...new Set([...(assignedSiteIds || []), ...(siteId ? [siteId] : [])].map(String))];
      if (!siteId) siteId = assignedSiteIds[0] || null;
      const assignedSites = await Site.find({ _id: { $in: assignedSiteIds }, organisationId: req.user.organisationId, active: true }).select('_id managerId');
      if (assignedSites.length !== assignedSiteIds.length) return res.status(400).json({ error: 'One or more assigned sites are not active in this organisation.' });
      if (req.user.role === 'manager' && assignedSites.some(site => !userCanAccessSite(req.user, site._id) && String(site.managerId || '') !== String(req.user._id))) return res.status(403).json({ error: 'You cannot assign users outside your sites.' });
    }
    if (siteId) {
      const site = await Site.findOne({ _id: siteId, organisationId: req.user.organisationId, active: true });
      if (!site) return res.status(400).json({ error: 'The selected site is not active in this organisation.' });
      const managerOwnsSite = String(site.managerId || '') === String(req.user._id);
      if (req.user.role === 'manager' && !userCanAccessSite(req.user, siteId) && !managerOwnsSite) {
        return res.status(403).json({ error: 'You cannot assign users outside your sites.' });
      }
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
      assignedSiteIds: role === 'guard' ? assignedSiteIds : [],
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
  authenticate, requireRole('manager','admin','superadmin'),
  [
    body('role').optional().isIn(['guard','manager','admin','superadmin']),
    body('password').optional().isLength({ min: 6 }),
    body('email').optional().isEmail().normalizeEmail(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ _id: req.params.id, organisationId: req.user.organisationId }).select('+password +refreshTokenHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Role & site access restrictions for managers
    if (req.user.role === 'manager') {
      if (['admin', 'superadmin'].includes(user.role)) {
        return res.status(403).json({ error: 'Managers cannot edit administrator accounts.' });
      }
      const targetSiteIds = [user.siteId, ...(user.assignedSiteIds || []), ...(user.managedSiteIds || [])].filter(Boolean).map(String);
      const accessibleSiteIds = await getManagerSiteIds(req.user);
      if (!targetSiteIds.some(id => accessibleSiteIds.includes(id))) {
        return res.status(403).json({ error: 'You cannot manage this account outside your assigned sites.' });
      }
      if (req.body.siteId && !accessibleSiteIds.includes(String(req.body.siteId))) {
        return res.status(403).json({ error: 'You cannot assign users outside your sites.' });
      }
      if (req.body.assignedSiteIds?.some(id => !accessibleSiteIds.includes(String(id)))) return res.status(403).json({ error: 'You cannot assign users outside your sites.' });
      if (req.body.managedSiteIds?.some(id => !userCanAccessSite(req.user, id))) {
        return res.status(403).json({ error: 'You cannot assign managers outside your sites.' });
      }
    }
    
    if (user.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only Super Administrators can edit Super Administrator accounts.' });
    }

    if (req.body.email && req.body.email !== user.email) {
      const existing = await User.findOne({
        organisationId: req.user.organisationId,
        email: req.body.email,
        _id: { $ne: user._id }
      });
      if (existing) return res.status(400).json({ error: 'Email already registered to another user.' });
      user.email = req.body.email;
    }

    const allowed = ['name','email','phone','badgeNumber','siteId','assignedSiteIds','managedSiteIds','active','avatarUrl','role'];
    allowed.forEach(key => { if (req.body[key] !== undefined) user[key] = req.body[key]; });
    if (user.role === 'guard' && req.body.assignedSiteIds !== undefined) {
      user.assignedSiteIds = [...new Set([...(req.body.assignedSiteIds || []), ...(req.body.siteId || user.siteId ? [req.body.siteId || user.siteId] : [])].map(String))];
      const count = await Site.countDocuments({ _id: { $in: user.assignedSiteIds }, organisationId: req.user.organisationId, active: true });
      if (!user.assignedSiteIds.length || count !== user.assignedSiteIds.length) return res.status(400).json({ error: 'One or more assigned sites are invalid or inactive.' });
      if (!user.assignedSiteIds.some(id => String(id) === String(user.siteId))) user.siteId = user.assignedSiteIds[0];
    }
    
    if (req.body.password) {
      user.password = req.body.password;
      user.refreshTokenHash = null;
    }
    
    if (user.role === 'guard' && !user.siteId && req.body.siteId === null) {
      return res.status(400).json({ error: 'A guard account must be assigned to a site.' });
    }
    
    await user.save();
    await audit({ req, action: req.body.password ? 'password_changed' : 'account_edited', targetModel: 'User', targetId: user._id, targetName: user.name });
    const safe = user.toObject();
    delete safe.password;
    delete safe.refreshTokenHash;
    res.json({ user: safe });
  })
);

router.delete('/users/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    const isSelf = String(req.user._id) === String(req.params.id);
    if (!isSelf && !['manager', 'admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to delete this account.' });
    }
    const user = await User.findOne({ _id: req.params.id, organisationId: req.user.organisationId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!isSelf && req.user.role === 'manager' && user.role !== 'admin' && user.role !== 'superadmin') {
      const targetSiteIds = [user.siteId, ...(user.assignedSiteIds || []), ...(user.managedSiteIds || [])].filter(Boolean).map(String);
      const allowedSiteIds = await getManagerSiteIds(req.user);
      if (!targetSiteIds.some(id => allowedSiteIds.includes(id))) return res.status(403).json({ error: 'Account is outside your assigned sites.' });
    }
    if (!isSelf && ['admin', 'superadmin'].includes(user.role) && !['admin', 'superadmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Managers cannot delete administrator accounts.' });
    }
    await ShiftRoster.deleteMany({ organisationId: req.user.organisationId, guardId: user._id });
    await Alert.deleteMany({ organisationId: req.user.organisationId, guardId: user._id });
    // Close any open shift sessions so the guard stops generating alerts
    await require('../models').ShiftSession.updateMany(
      { organisationId: req.user.organisationId, guardId: user._id, bookedOffAt: null },
      { bookedOffAt: new Date(), autoClosedOnDelete: true }
    );
    await User.deleteOne({ _id: user._id });
    await audit({ req, action: isSelf ? 'account_self_deleted' : 'account_deleted', targetModel: 'User', targetId: user._id, targetName: user.name });
    res.json({ message: 'User account permanently deleted' });
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
    filter._id = { $in: [...new Set([req.user.siteId, ...(req.user.assignedSiteIds || [])].filter(Boolean).map(String))] };
  } else if (req.user.role === 'manager') {
    filter.$or = [
      { _id: { $in: await getManagerSiteIds(req.user) } },
      { managerId: req.user._id },
    ];
  }
  const sites = await Site.find(filter).sort({ name: 1 });
  res.json({ sites });
}));

router.post('/sites',
  authenticate, requireRole('manager','admin','superadmin'),
  [
    body('name').trim().notEmpty(),
    body('address').optional().trim(),
    body('managerId').optional(),
    body('what3words').optional().trim(),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('altitude').optional().isNumeric(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    let {
      name, address, postcode, managerId: requestedManagerId,
      latitude, longitude, altitude, what3words, location,
      geofenceRadiusMetres, notes
    } = req.body;

    let managerId = requestedManagerId || (req.user.role === 'manager' ? req.user._id : null);
    if (!managerId) {
      const defaultMgr = await User.findOne({ organisationId: req.user.organisationId, role: { $in: ['manager', 'admin', 'superadmin'] }, active: true });
      managerId = defaultMgr ? defaultMgr._id : req.user._id;
    }
    if (req.user.role === 'manager' && String(managerId) !== String(req.user._id)) {
      return res.status(403).json({ error: 'You may only create sites assigned to yourself.' });
    }

    const normalizedName = String(name || '').trim();
    const normalizedAddress = String(address || '').trim().toLowerCase();
    const escapedAddress = normalizedAddress.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedName = normalizedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const duplicate = await Site.findOne({
      organisationId: req.user.organisationId,
      managerId,
      active: true,
      name: { $regex: `^${escapedName}$`, $options: 'i' },
      address: normalizedAddress ? { $regex: `^${escapedAddress}$`, $options: 'i' } : { $in: [null, ''] },
    });
    if (duplicate) {
      await User.findByIdAndUpdate(managerId, { $addToSet: { managedSiteIds: duplicate._id } });
      return res.status(200).json({ site: duplicate, alreadyRegistered: true });
    }

    let siteLocation = location;
    let latNum = latitude != null ? Number(latitude) : null;
    let lngNum = longitude != null ? Number(longitude) : null;
    const altNum = altitude != null ? Number(altitude) : null;

    let finalW3w = normalizeW3W(what3words);

    if (finalW3w && !isValidWhat3Words(finalW3w)) {
      return res.status(400).json({ error: 'Enter a valid What3Words address in ///word.word.word format.' });
    }

    if (finalW3w && (latNum == null || lngNum == null)) {
      const coords = await getCoordinatesFromWhat3Words(finalW3w);
      if (coords) {
        latNum = coords.latitude;
        lngNum = coords.longitude;
      } else {
        return res.status(422).json({ error: 'The What3Words address could not be verified. Check the address and What3Words API configuration, or capture GPS coordinates.' });
      }
    }

    if (!finalW3w && latNum != null && lngNum != null) {
      finalW3w = await getWhat3WordsFromCoordinates(latNum, lngNum);
    }

    if (!siteLocation && latNum != null && lngNum != null) {
      siteLocation = {
        type: 'Point',
        coordinates: [lngNum, latNum],
      };
    }

    const site = await Site.create({
      organisationId: req.user.organisationId,
      managerId,
      name,
      address: address || null,
      postcode: postcode || null,
      what3words: finalW3w,
      latitude: latNum,
      longitude: lngNum,
      altitude: altNum,
      location: siteLocation || undefined,
      geofenceRadiusMetres: geofenceRadiusMetres || 200,
      notes: notes || null,
    });
    await User.findByIdAndUpdate(managerId, { $addToSet: { managedSiteIds: site._id } });
    await audit({ req, action: 'site_created', targetModel: 'Site', targetId: site._id, targetName: site.name });
    res.status(201).json({ site, what3wordsLookupUnavailable: Boolean(latNum != null && lngNum != null && !finalW3w) });
  })
);

router.get('/sites/:id', authenticate, asyncHandler(async (req, res) => {
  const site = await Site.findOne({ _id: req.params.id, organisationId: req.user.organisationId });
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (!userCanAccessSite(req.user, site._id)) return res.status(403).json({ error: 'Site is outside your assigned area.' });
  res.json({ site });
}));

router.patch('/sites/:id',
  authenticate, requireRole('manager','admin','superadmin'),
  [
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('altitude').optional().isNumeric(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const allowed = [
      'name','address','postcode','what3words','latitude','longitude','altitude',
      'location','geofenceRadiusMetres','notes','active','managerId'
    ];
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    if (req.user.role === 'manager') {
      if (updates.managerId && String(updates.managerId) !== String(req.user._id)) {
        return res.status(403).json({ error: 'You may only assign sites to yourself.' });
      }
      if (!userCanAccessSite(req.user, req.params.id)) {
        return res.status(403).json({ error: 'Site is outside your assigned area.' });
      }
    }
    if (updates.managerId) {
      const assignedManager = await User.findOne({
        _id: updates.managerId,
        organisationId: req.user.organisationId,
        role: { $in: ['manager', 'admin', 'superadmin'] },
        active: true
      });
      if (!assignedManager) return res.status(400).json({ error: 'The selected site manager is not active in this organisation.' });
    }

    if (updates.what3words !== undefined) {
      updates.what3words = normalizeW3W(updates.what3words);
      if (updates.what3words && !isValidWhat3Words(updates.what3words)) {
        return res.status(400).json({ error: 'Enter a valid What3Words address in ///word.word.word format.' });
      }
      if (updates.what3words && updates.latitude == null && updates.longitude == null) {
        const coords = await getCoordinatesFromWhat3Words(updates.what3words);
        if (coords) {
          updates.latitude = coords.latitude;
          updates.longitude = coords.longitude;
          updates.location = {
            type: 'Point',
            coordinates: [coords.longitude, coords.latitude],
          };
        }
      }
    }

    if (updates.latitude != null || updates.longitude != null) {
      const lat = updates.latitude != null ? Number(updates.latitude) : undefined;
      const lng = updates.longitude != null ? Number(updates.longitude) : undefined;
      if (lat !== undefined && lng !== undefined) {
        updates.location = {
          type: 'Point',
          coordinates: [lng, lat],
        };
        if (!updates.what3words) {
          updates.what3words = await getWhat3WordsFromCoordinates(lat, lng);
        }
      }
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
    await audit({ req, action: 'site_updated', targetModel: 'Site', targetId: site._id, targetName: site.name });
    res.json({ site });
  })
);

router.delete('/sites/:id',
  authenticate, requireRole('manager','admin','superadmin'),
  asyncHandler(async (req, res) => {
    const site = await Site.findOne({ _id: req.params.id, organisationId: req.user.organisationId, active: true });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    if (req.user.role === 'manager' && !(await getManagerSiteIds(req.user)).includes(String(site._id))) {
      return res.status(403).json({ error: 'Site is outside your assigned area.' });
    }
    site.active = false;
    await site.save();
    await User.updateMany(
      { _id: site.managerId, organisationId: req.user.organisationId },
      { $pull: { managedSiteIds: site._id } }
    );
    const affectedGuards = await User.find({
      organisationId: req.user.organisationId,
      role: 'guard',
      $or: [{ siteId: site._id }, { assignedSiteIds: site._id }],
    }).select('_id siteId assignedSiteIds');
    for (const guard of affectedGuards) {
      const remainingSiteIds = (guard.assignedSiteIds || []).filter(id => String(id) !== String(site._id));
      const nextPrimarySite = String(guard.siteId || '') === String(site._id)
        ? (remainingSiteIds[0] || null)
        : guard.siteId;
      await User.updateOne(
        { _id: guard._id },
        { $set: { siteId: nextPrimarySite, assignedSiteIds: remainingSiteIds } }
      );
    }
    await audit({ req, action: 'site_deleted', targetModel: 'Site', targetId: site._id, targetName: site.name });
    res.json({ message: 'Site deactivated and removed from active assignments.' });
  })
);

module.exports = router;
