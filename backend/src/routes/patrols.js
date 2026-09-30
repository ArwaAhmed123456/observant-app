/**
 * Patrol routes
 *
 * POST /api/patrols/start                   — start patrol session
 * POST /api/patrols/:id/capture             — upload checkpoint photo
 * POST /api/patrols/:id/finish              — finish patrol
 * GET  /api/patrols                         — list patrol sessions
 * GET  /api/patrols/:id                     — get one with captures
 *
 * Checkpoints (site config):
 * GET  /api/patrols/checkpoints             — list checkpoints for a site
 * POST /api/patrols/checkpoints             — add checkpoint (manager)
 * PATCH /api/patrols/checkpoints/:id        — update checkpoint
 * DELETE /api/patrols/checkpoints/:id       — delete checkpoint
 *
 * Random prompt log:
 * POST /api/patrols/random-prompt           — log a random anti-idle prompt
 * POST /api/patrols/random-prompt/:id/respond — mark as responded
 */
const router = require('express').Router();
const { body } = require('express-validator');
const {
  PatrolSession, PatrolCheckpoint, RandomPromptLog, ShiftSession, ShiftRoster, User
} = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate     = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { createAlert } = require('../services/alertService');
const { upload: uploadPhoto, saveImage } = require('../services/mediaStore');
const { getMondayOfWeek, dayKey } = require('../utils/dateHelpers');

// ════════════════════════════════════════════════════════════
// CHECKPOINT CONFIG
// ════════════════════════════════════════════════════════════

router.get('/checkpoints', authenticate, requireRole('guard','manager','admin'), asyncHandler(async (req, res) => {
  const { siteId } = req.query;
  if (!siteId) return res.status(400).json({ error: 'siteId query param required' });
  const site = await require('../models').Site.findOne({ _id: siteId, organisationId: req.user.organisationId, active: true });
  if (!site) return res.status(404).json({ error: 'Site not found.' });
  if (req.user.role === 'guard' && String(req.user.siteId) !== String(site._id)) return res.status(403).json({ error: 'Site is outside your assignment.' });
  if (req.user.role === 'manager' && !req.user.managedSiteIds.some(id => String(id) === String(site._id))) return res.status(403).json({ error: 'Site is outside your assigned area.' });
  const cps = await PatrolCheckpoint.find({
    organisationId: req.user.organisationId,
    siteId,
    active: true,
  }).sort({ order: 1 });
  res.json({ checkpoints: cps });
}));

router.post('/checkpoints',
  authenticate, requireRole('manager','admin'),
  [
    body('siteId').isMongoId(),
    body('name').trim().notEmpty(),
    body('order').optional().isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { siteId, name, order, required, nfcRequired, nfcTagId, qrCode } = req.body;
    if (nfcRequired && !nfcTagId) return res.status(400).json({ error: 'Pair an NFC tag before requiring NFC verification.' });
    const site = await require('../models').Site.findOne({ _id: siteId, organisationId: req.user.organisationId, active: true });
    if (!site) return res.status(404).json({ error: 'Site not found.' });
    if (req.user.role === 'manager' && !req.user.managedSiteIds.some(id => String(id) === String(site._id))) return res.status(403).json({ error: 'Site is outside your assigned area.' });
    const maxOrder = await PatrolCheckpoint.countDocuments({
      organisationId: req.user.organisationId, siteId
    });
    const cp = await PatrolCheckpoint.create({
      organisationId: req.user.organisationId,
      siteId,
      name,
      order:    order || maxOrder + 1,
      required: required !== false,
      nfcRequired: Boolean(nfcRequired),
      nfcTagId: nfcTagId || null,
      qrCode:   qrCode || null,
    });
    res.status(201).json({ checkpoint: cp });
  })
);

router.patch('/checkpoints/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const allowed = ['name','order','required','nfcRequired','nfcTagId','active','qrCode','location'];
    const checkpoint = await PatrolCheckpoint.findOne({ _id: req.params.id, organisationId: req.user.organisationId });
    if (!checkpoint) return res.status(404).json({ error: 'Checkpoint not found.' });
    if (req.user.role === 'manager' && !req.user.managedSiteIds.some(id => String(id) === String(checkpoint.siteId))) return res.status(403).json({ error: 'Checkpoint is outside your assigned area.' });
    const updates = {};
    allowed.forEach(k => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });
    if (updates.nfcRequired === true && !(updates.nfcTagId || checkpoint.nfcTagId)) {
      return res.status(400).json({ error: 'Pair an NFC tag before requiring NFC verification.' });
    }
    if (updates.location?.coordinates?.length === 2) {
      const [longitude, latitude] = updates.location.coordinates;
      updates.location.coordinates = [Number(longitude), Number(latitude)];
    }
    const cp = await PatrolCheckpoint.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId },
      updates, { new: true }
    );
    if (!cp) return res.status(404).json({ error: 'Checkpoint not found' });
    res.json({ checkpoint: cp });
  })
);

router.delete('/checkpoints/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const checkpoint = await PatrolCheckpoint.findOne({ _id: req.params.id, organisationId: req.user.organisationId });
    if (!checkpoint) return res.status(404).json({ error: 'Checkpoint not found.' });
    if (req.user.role === 'manager' && !req.user.managedSiteIds.some(id => String(id) === String(checkpoint.siteId))) return res.status(403).json({ error: 'Checkpoint is outside your assigned area.' });
    await PatrolCheckpoint.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId },
      { active: false }
    );
    res.json({ message: 'Checkpoint deactivated' });
  })
);

// ════════════════════════════════════════════════════════════
// PATROL SESSIONS
// ════════════════════════════════════════════════════════════

// ── Start patrol ──────────────────────────────────────────────────────────────
router.post('/start',
  authenticate, requireRole('guard'),
  [body('triggeredByAntiIdle').optional().isBoolean()],
  asyncHandler(async (req, res) => {
    const orgId   = req.user.organisationId;
    const guardId = req.user._id;

    const session = await ShiftSession.findOne({ organisationId: orgId, guardId, bookedOffAt: null });
    if (!session) return res.status(400).json({ error: 'No active shift. Book on first.' });
    const activePrompt = await RandomPromptLog.findOne({
      organisationId: orgId, guardId, shiftSessionId: session._id,
      responded: false, managerAlerted: false, expiresAt: { $gt: new Date() },
    }).sort({ triggeredAt: -1 });
    if (req.body.triggeredByAntiIdle && !activePrompt) return res.status(410).json({ error: 'There is no active surprise patrol response window.' });
    const roster = await ShiftRoster.findOne({ organisationId: orgId, guardId, weekStartDate: getMondayOfWeek() }).select('days checkpointIds');
    const assignedCheckpointIds = roster?.days?.[dayKey()] && roster.checkpointIds?.length ? roster.checkpointIds : [];

    // If already has an in-progress patrol, return it
    const existing = await PatrolSession.findOne({
      organisationId: orgId, guardId, status: 'in_progress'
    });
    if (existing) {
      if (activePrompt) {
        activePrompt.responded = true;
        activePrompt.respondedAt = new Date();
        activePrompt.patrolSessionId = existing._id;
        await activePrompt.save();
      }
      return res.json({ patrol: existing, alreadyActive: true });
    }

    const latest = await PatrolSession.findOne({ organisationId: orgId, guardId, status: { $in: ['complete', 'incomplete'] } }).sort({ finishedAt: -1 });
    if (latest?.finishedAt && Date.now() - new Date(latest.finishedAt).getTime() < 60 * 60 * 1000 && !activePrompt) {
      return res.status(429).json({ error: 'The next hourly patrol is not due yet. Complete a random patrol prompt if one is active.' });
    }

    const patrol = await PatrolSession.create({
      organisationId:      orgId,
      shiftSessionId:      session._id,
      guardId,
      siteId:              session.siteId,
      assignedCheckpointIds,
      startedAt:           new Date(),
      triggeredByAntiIdle: Boolean(activePrompt),
    });
    await ShiftSession.findByIdAndUpdate(session._id, { $set: { nextRandomPromptAt: null } });
    if (activePrompt) {
      activePrompt.responded = true;
      activePrompt.respondedAt = new Date();
      activePrompt.patrolSessionId = patrol._id;
      await activePrompt.save();
    }

    res.status(201).json({ patrol });
  })
);

// ── Capture checkpoint proof (photo, NFC tag, or both) ────────────────────────
router.post('/:id/capture',
  authenticate, requireRole('guard'),
  (req, res, next) => {
    uploadPhoto.single('photo')(req, res, err => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  asyncHandler(async (req, res) => {
    const { checkpointId, latitude, longitude, nfcTagId } = req.body;
    if (!checkpointId) return res.status(400).json({ error: 'checkpointId required' });

    const patrol = await PatrolSession.findOne({
      _id: req.params.id,
      organisationId: req.user.organisationId,
      guardId: req.user._id,
      status: 'in_progress',
    });
    if (!patrol) return res.status(404).json({ error: 'Active patrol not found' });

    const checkpoint = await PatrolCheckpoint.findOne({ _id: checkpointId, organisationId: req.user.organisationId, siteId: patrol.siteId, active: true });
    if (!checkpoint) return res.status(400).json({ error: 'Checkpoint does not belong to this active patrol site.' });
    if (patrol.assignedCheckpointIds?.length && !patrol.assignedCheckpointIds.map(String).includes(String(checkpoint._id))) {
      return res.status(400).json({ error: 'This checkpoint is not assigned to your current rota.' });
    }

    if (!checkpoint.required && !checkpoint.nfcRequired) return res.status(400).json({ error: 'This checkpoint has no required proof method.' });
    if (!req.file && !nfcTagId) return res.status(400).json({ error: 'Capture a required photo or scan the assigned NFC card.' });
    if (req.file && !checkpoint.required) return res.status(400).json({ error: 'A photo is not required for this checkpoint.' });
    if (nfcTagId && !checkpoint.nfcRequired) return res.status(400).json({ error: 'An NFC scan is not required for this checkpoint.' });
    const cleanTagId = value => String(value || '').replace(/[^a-f0-9]/gi, '').toLowerCase();
    if (nfcTagId && checkpoint.nfcRequired && cleanTagId(nfcTagId) !== cleanTagId(checkpoint.nfcTagId)) {
      return res.status(400).json({ error: 'NFC card does not match the tag assigned to this checkpoint.' });
    }

    const fileId = req.file ? await saveImage(req.file, {
      organisationId: req.user.organisationId.toString(),
      guardId: req.user._id.toString(),
      patrolId: patrol._id.toString(),
    }) : null;
    let capture = patrol.captures.find(item => String(item.checkpointId) === String(checkpointId));
    if (!capture) {
      capture = { checkpointId, photoUrl: null, publicId: null, nfcTagId: null, nfcVerifiedAt: null, capturedAt: new Date() };
      patrol.captures.push(capture);
    }
    if (fileId) {
      capture.photoUrl = `${req.protocol}://${req.get('host')}/api/media/${fileId}`;
      capture.publicId = fileId;
    }
    if (nfcTagId) {
      capture.nfcTagId = nfcTagId;
      capture.nfcVerifiedAt = new Date();
    }
    capture.capturedAt = new Date();
    capture.latitude = latitude !== undefined && latitude !== '' ? parseFloat(latitude) : capture.latitude ?? null;
    capture.longitude = longitude !== undefined && longitude !== '' ? parseFloat(longitude) : capture.longitude ?? null;
    if (!patrol.capturedCheckpointIds.map(String).includes(String(checkpointId))) patrol.capturedCheckpointIds.push(checkpointId);
    await patrol.save();

    res.json({ patrol, capture });
  })
);

// ── Finish patrol ─────────────────────────────────────────────────────────────
router.post('/:id/finish',
  authenticate, requireRole('guard'),
  [body('forceFinish').optional().isBoolean()],
  asyncHandler(async (req, res) => {
    const orgId   = req.user.organisationId;
    const guardId = req.user._id;
    const forceFinish = req.body.forceFinish || false;

    const patrol = await PatrolSession.findOne({
      _id: req.params.id, organisationId: orgId, guardId, status: 'in_progress'
    });
    if (!patrol) return res.status(404).json({ error: 'Active patrol not found' });

    // Find required checkpoints for this site
    const required = await PatrolCheckpoint.find({
      organisationId: orgId,
      siteId: patrol.siteId,
      active: true,
      ...(patrol.assignedCheckpointIds?.length ? { _id: { $in: patrol.assignedCheckpointIds } } : {}),
      $or: [{ required: true }, { nfcRequired: true }],
    }).select('_id required nfcRequired');

    const missingIds   = required.filter(cp => {
      const capture = patrol.captures.find(item => String(item.checkpointId) === String(cp._id));
      return !capture || (cp.required && !capture.photoUrl) || (cp.nfcRequired && !capture.nfcVerifiedAt);
    }).map(cp => cp._id.toString());

    if (missingIds.length > 0 && !forceFinish) {
      return res.status(422).json({
        incomplete: true,
        missingCheckpointIds: missingIds,
        message: `${missingIds.length} required checkpoint(s) are missing photo or NFC verification.`,
      });
    }

    const latest = await PatrolSession.findOne({ organisationId: orgId, guardId, _id: { $ne: patrol._id }, status: { $in: ['complete', 'incomplete'] } }).sort({ finishedAt: -1 });
    if (latest?.finishedAt && Date.now() - new Date(latest.finishedAt).getTime() < 30 * 60 * 1000 && !patrol.triggeredByAntiIdle) {
      return res.status(429).json({ error: 'A patrol cannot be repeated again this soon.' });
    }

    const now    = new Date();
    const status = missingIds.length > 0 ? 'incomplete' : 'complete';

    patrol.finishedAt           = now;
    patrol.status               = status;
    patrol.missingCheckpointIds = missingIds;
    await patrol.save();

    // Update session patrol counter
    await ShiftSession.findByIdAndUpdate(patrol.shiftSessionId, { $inc: { patrolCount: 1 } });
    const nextRandomPromptAt = new Date(now.getTime() + (10 + Math.random() * 20) * 60 * 1000);
    await ShiftSession.findByIdAndUpdate(patrol.shiftSessionId, { nextRandomPromptAt });

    // Alert managers if incomplete
    if (status === 'incomplete') {
      const guard = await User.findById(guardId).select('name badgeNumber');
      await createAlert({
        organisationId: orgId,
        siteId:   patrol.siteId,
        guardId,
        type:     'patrol_missing_checkpoints',
        title:    '⚠️ Patrol finished with missing checkpoints',
        message:  `${guard.name} finished a patrol with ${missingIds.length} checkpoint(s) missing.`,
        refModel: 'PatrolSession',
        refId:    patrol._id,
      });
      patrol.managerAlerted = true;
      await patrol.save();
    }

    res.json({ patrol });
  })
);

// ── List patrols ──────────────────────────────────────────────────────────────
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { guardId, siteId, status, sessionId, from, to, limit = 50, page = 1 } = req.query;
    const orgId = req.user.organisationId;
    const filter = { organisationId: orgId };

    if (req.user.role === 'guard') filter.guardId = req.user._id;
    else if (guardId) filter.guardId = guardId;

    if (siteId)    filter.siteId    = siteId;
    if (status)    filter.status    = status;
    if (sessionId) filter.shiftSessionId = sessionId;
    if (from || to) {
      filter.startedAt = {};
      if (from) filter.startedAt.$gte = new Date(from);
      if (to)   filter.startedAt.$lte = new Date(to);
    }
    if (req.user.role === 'manager') {
      if (siteId && !req.user.managedSiteIds.some(id => String(id) === String(siteId))) {
        return res.status(403).json({ error: 'Site is outside your assigned area.' });
      }
      filter.siteId = siteId || { $in: req.user.managedSiteIds };
    }

    const [patrols, total] = await Promise.all([
      PatrolSession.find(filter)
        .sort({ startedAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('guardId', 'name badgeNumber')
        .populate('siteId',  'name')
        .select('-captures'),           // omit heavy captures array in list
      PatrolSession.countDocuments(filter),
    ]);

    res.json({ patrols, total, page: Number(page), limit: Number(limit) });
  })
);

// ── Get one patrol (with captures) ───────────────────────────────────────────
// Keep the static random-prompt path before /:id, which would otherwise catch it.
router.get('/random-prompt', authenticate, asyncHandler(async (req, res) => {
  const filter = { organisationId: req.user.organisationId };
  if (req.user.role === 'guard') filter.guardId = req.user._id;
  else if (req.query.guardId) filter.guardId = req.query.guardId;
  if (req.query.sessionId) filter.shiftSessionId = req.query.sessionId;
  const logs = await RandomPromptLog.find(filter).sort({ triggeredAt: -1 }).limit(Math.min(Number(req.query.limit) || 100, 200));
  res.json({ logs });
}));

router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const patrol = await PatrolSession.findOne({
    _id: req.params.id,
    organisationId: req.user.organisationId,
    ...(req.user.role === 'guard' ? { guardId: req.user._id } : {}),
    ...(req.user.role === 'manager' ? { siteId: { $in: req.user.managedSiteIds } } : {}),
  })
    .populate('guardId', 'name badgeNumber avatarUrl')
    .populate('siteId',  'name address')
    .populate('captures.checkpointId', 'name order');
  if (!patrol) return res.status(404).json({ error: 'Patrol not found' });
  res.json({ patrol });
}));

// ════════════════════════════════════════════════════════════
// RANDOM PROMPT LOGS
// ════════════════════════════════════════════════════════════

router.post('/random-prompt',
  authenticate, requireRole('guard'),
  asyncHandler(async (req, res) => {
    const orgId   = req.user.organisationId;
    const guardId = req.user._id;
    const session = await ShiftSession.findOne({ organisationId: orgId, guardId, bookedOffAt: null });
    if (!session) return res.status(400).json({ error: 'No active session' });

    const log = await RandomPromptLog.create({
      organisationId: orgId,
      shiftSessionId: session._id,
      guardId,
      siteId:         session.siteId,
    });
    res.status(201).json({ log });
  })
);

router.post('/random-prompt/:id/respond',
  authenticate, requireRole('guard'),
  [body('patrolSessionId').optional().isMongoId()],
  asyncHandler(async (req, res) => {
    const log = await RandomPromptLog.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.user.organisationId, guardId: req.user._id, responded: false, managerAlerted: false, expiresAt: { $gt: new Date() } },
      {
        responded:       true,
        respondedAt:     new Date(),
        patrolSessionId: req.body.patrolSessionId || null,
      },
      { new: true }
    );
    if (!log) return res.status(410).json({ error: 'The 10-minute surprise patrol response window has expired.' });
    res.json({ log });
  })
);

module.exports = router;
