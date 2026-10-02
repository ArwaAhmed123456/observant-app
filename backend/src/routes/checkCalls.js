/**
 * Check Call routes
 *
 * POST /api/check-calls/fire         — system/guard fires a check call (called by mobile after 1hr timer)
 * POST /api/check-calls/:id/respond  — guard responds (yes / no + optional note)
 * POST /api/check-calls/expire       — mobile calls this when 10-min window expires with no response
 * GET  /api/check-calls              — list check calls (filterable)
 * GET  /api/check-calls/:id          — get one
 */
const router = require('express').Router();
const { body } = require('express-validator');
const { CheckCall, ShiftSession, User } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate     = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { createAlert } = require('../services/alertService');
const { upload: uploadPhoto, saveImage } = require('../services/mediaStore');
const { Site } = require('../models');
const { audit } = require('../utils/auditLogger');

// Guard-initiated check calls are completed immediately and occupy the current
// scheduled hour. The following automatic call is aligned to the next hour.
router.post('/manual', authenticate, requireRole('guard'), [
  body('response').isIn(['yes', 'no']).withMessage('Response must be yes or no'),
  body('note').optional().trim().isLength({ max: 500 }),
  body('category').optional().trim().isLength({ max: 100 }),
], validate, asyncHandler(async (req, res) => {
  const now = new Date();
  const session = await ShiftSession.findOne({ organisationId: req.user.organisationId, guardId: req.user._id, bookedOffAt: null });
  if (!session) return res.status(400).json({ error: 'Book on before recording a check call.' });
  const hourStart = new Date(now); hourStart.setMinutes(0, 0, 0);
  const nextHour = new Date(hourStart.getTime() + 60 * 60 * 1000);
  const existing = await CheckCall.findOne({ sessionId: session._id, firedAt: { $gte: hourStart, $lt: nextHour } }).sort({ firedAt: -1 });
  if (existing) return res.status(409).json({ error: 'A check call is already recorded for this hour.', checkCall: existing });
  const call = await CheckCall.create({
    organisationId: req.user.organisationId, sessionId: session._id, guardId: req.user._id,
    siteId: session.siteId, firedAt: now, scheduledFor: hourStart, expiresAt: now,
    respondedAt: now, response: req.body.response, note: req.body.note || null,
    category: req.body.category || null, isManualLog: true,
  });
  await ShiftSession.findByIdAndUpdate(session._id, {
    $inc: { checkCallCount: 1 }, $set: { nextCheckCallAt: nextHour },
  });
  if (req.body.response === 'no') {
    const guard = await User.findById(req.user._id).select('name');
    await createAlert({ organisationId: req.user.organisationId, siteId: session.siteId, guardId: req.user._id,
      type: 'check_call_issue', title: 'Issue reported by guard',
      message: `${guard?.name || 'Guard'} reported an issue during a manual check call at ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`,
      note: req.body.note || null, refModel: 'CheckCall', refId: call._id });
    await CheckCall.findByIdAndUpdate(call._id, { managerAlerted: true, managerAlertedAt: now });
  }
  await audit({ req, action: req.body.response === 'no' ? 'issue_reported' : 'check_call_completed', targetModel: 'CheckCall', targetId: call._id, targetName: req.user.name, details: { manual: true, response: req.body.response } });
  res.status(201).json({ checkCall: call });
}));

// ── Fire a check call ─────────────────────────────────────────────────────────
router.post('/fire',
  authenticate, requireRole('guard'),
  asyncHandler(async (req, res) => {
    const orgId   = req.user.organisationId;
    const guardId = req.user._id;

    // Find active session
    const session = await ShiftSession.findOne({ organisationId: orgId, guardId, bookedOffAt: null });
    if (!session) return res.status(400).json({ error: 'No active shift session. Book on first.' });

    const now      = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    const cc = await CheckCall.create({
      organisationId: orgId,
      sessionId:      session._id,
      guardId,
      siteId:         session.siteId,
      firedAt:        now,
      expiresAt,
      isRandom:       req.body.isRandom || false,
    });
    await ShiftSession.findByIdAndUpdate(session._id, { nextCheckCallAt: null });

    res.status(201).json({ checkCall: cc });
  })
);

// ── Respond to a check call ───────────────────────────────────────────────────
router.post('/:id/respond',
  authenticate, requireRole('guard'),
  (req, res, next) => uploadPhoto.single('photo')(req, res, err => err ? res.status(400).json({ error: err.message }) : next()),
  [
    body('response').isIn(['yes', 'no']).withMessage('Response must be yes or no'),
    body('note').optional().trim().isLength({ max: 500 }),
    body('category').optional().trim().isLength({ max: 100 }),
    body('latitude').optional().isFloat(),
    body('longitude').optional().isFloat(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { response, note } = req.body;
    const orgId   = req.user.organisationId;
    const guardId = req.user._id;
    const now     = new Date();

    const cc = await CheckCall.findOne({
      _id: req.params.id,
      organisationId: orgId,
      guardId,
      response: null,
    });
    if (!cc) return res.status(404).json({ error: 'Check call not found or already responded' });

    // Reject responses after expiry
    if (now > cc.expiresAt) {
      return res.status(400).json({ error: 'Response window has expired' });
    }

    if (req.body.latitude != null && req.body.longitude != null) {
      cc.location = { latitude: Number(req.body.latitude), longitude: Number(req.body.longitude) };
      const site = await Site.findById(cc.siteId).select('location geofenceRadiusMetres');
      const [siteLon, siteLat] = site?.location?.coordinates || [];
      if (siteLat != null && siteLon != null) {
        const rad = deg => deg * Math.PI / 180;
        const lat1 = Number(req.body.latitude), lon1 = Number(req.body.longitude);
        const dLat = rad(siteLat - lat1), dLon = rad(siteLon - lon1);
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(siteLat)) * Math.sin(dLon / 2) ** 2;
        const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        if (distance > (site.geofenceRadiusMetres || 200)) {
          await createAlert({ organisationId: orgId, siteId: cc.siteId, guardId, type: 'geofence_warning', title: 'Guard outside site perimeter', message: `Guard submitted a check call approximately ${Math.round(distance)} metres outside the site boundary.`, refModel: 'CheckCall', refId: cc._id });
        }
      }
    }

    if (req.file) {
      const fileId = await saveImage(req.file, { organisationId: orgId.toString(), guardId: guardId.toString(), checkCallId: cc._id.toString() });
      cc.photoUrl = `${req.protocol}://${req.get('host')}/api/media/${fileId}`;
    }

    cc.response    = response;
    cc.respondedAt = now;
    cc.note        = note || null;
    cc.category    = req.body.category || null;
    await cc.save();

    // Update session counter
    await ShiftSession.findByIdAndUpdate(cc.sessionId, {
      $inc: { checkCallCount: 1 },
      $set: { nextCheckCallAt: (() => { const hour = new Date(cc.scheduledFor || cc.firedAt); hour.setMinutes(0, 0, 0); return new Date(hour.getTime() + 60 * 60 * 1000); })() },
    });

    // If guard reported an issue, alert managers
    if (response === 'no') {
      const guard = await User.findById(guardId).select('name badgeNumber');
      await createAlert({
        organisationId: orgId,
        siteId:   cc.siteId,
        guardId,
        type:     'check_call_issue',
        title:    '⚠️ Issue reported on site',
        message:  `${guard.name} reported an issue at ${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
        note:     note || null,
        refModel: 'CheckCall',
        refId:    cc._id,
      });
      await CheckCall.findByIdAndUpdate(cc._id, { managerAlerted: true, managerAlertedAt: now });
    }

    await audit({ req, action: response === 'no' ? 'issue_reported' : 'check_call_completed', targetModel: 'CheckCall', targetId: cc._id, targetName: req.user.name, details: { response, category: cc.category } });

    res.json({ checkCall: cc });
  })
);

// ── Expire a check call (called by mobile when 10-min window elapses) ─────────
router.post('/expire',
  authenticate, requireRole('guard'),
  [body('checkCallId').isMongoId()],
  validate,
  asyncHandler(async (req, res) => {
    const { checkCallId } = req.body;
    const orgId   = req.user.organisationId;
    const guardId = req.user._id;
    const now     = new Date();

    const cc = await CheckCall.findOneAndUpdate({
      _id:            checkCallId,
      organisationId: orgId,
      guardId,
      response:       null,
      expiresAt:      { $lte: now },
    }, { $set: { response: 'missed', managerAlerted: true, managerAlertedAt: now } }, { new: true });
    if (!cc) return res.status(404).json({ error: 'Check call not found or already responded' });

    // Update session missed counter
    if (cc.sessionId) await ShiftSession.findByIdAndUpdate(cc.sessionId, {
      $inc: { missedCheckCallCount: 1 },
      $set: { nextCheckCallAt: (() => { const hour = new Date(cc.scheduledFor || cc.firedAt); hour.setMinutes(0, 0, 0); return new Date(hour.getTime() + 60 * 60 * 1000); })() },
    });

    // Alert managers
    const guard = await User.findById(guardId).select('name badgeNumber');
    await createAlert({
      organisationId: orgId,
      siteId:   cc.siteId,
      guardId,
      type:     'check_call_missed',
      title:    '🚨 Missed check call',
      message:  `${guard.name} did not respond to check call at ${new Date(cc.firedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
      refModel: 'CheckCall',
      refId:    cc._id,
    });

    res.json({ checkCall: cc });
  })
);

// ── List check calls ──────────────────────────────────────────────────────────
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { guardId, siteId, sessionId, response, from, to, limit = 100, page = 1 } = req.query;
    const orgId = req.user.organisationId;

    const filter = { organisationId: orgId };

    if (req.user.role === 'guard') {
      filter.guardId = req.user._id;
    } else {
      if (guardId)   filter.guardId   = guardId;
      if (req.user.role === 'manager') {
        const allowedSites = req.user.managedSiteIds.map(String);
        if (siteId && !allowedSites.includes(String(siteId))) filter.siteId = null;
        else filter.siteId = siteId || { $in: req.user.managedSiteIds };
      } else if (siteId) filter.siteId = siteId;
    }
    if (sessionId) filter.sessionId = sessionId;
    if (response)  filter.response  = response;
    if (from || to) {
      filter.firedAt = {};
      if (from) filter.firedAt.$gte = new Date(from);
      if (to)   filter.firedAt.$lte = new Date(to);
    }

    const [checkCalls, total] = await Promise.all([
      CheckCall.find(filter)
        .sort({ firedAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('guardId', 'name badgeNumber')
        .populate('siteId',  'name'),
      CheckCall.countDocuments(filter),
    ]);

    res.json({ checkCalls, total, page: Number(page), limit: Number(limit) });
  })
);

// ── Get one check call ────────────────────────────────────────────────────────
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const cc = await CheckCall.findOne({
    _id: req.params.id,
    organisationId: req.user.organisationId,
    ...(req.user.role === 'guard' ? { guardId: req.user._id } : {}),
    ...(req.user.role === 'manager' ? { siteId: { $in: req.user.managedSiteIds } } : {}),
  })
    .populate('guardId', 'name badgeNumber')
    .populate('siteId',  'name');
  if (!cc) return res.status(404).json({ error: 'Not found' });
  res.json({ checkCall: cc });
}));

module.exports = router;
