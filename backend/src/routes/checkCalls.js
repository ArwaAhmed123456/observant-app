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

    res.status(201).json({ checkCall: cc });
  })
);

// ── Respond to a check call ───────────────────────────────────────────────────
router.post('/:id/respond',
  authenticate, requireRole('guard'),
  [
    body('response').isIn(['yes', 'no']).withMessage('Response must be yes or no'),
    body('note').optional().trim().isLength({ max: 500 }),
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

    cc.response    = response;
    cc.respondedAt = now;
    cc.note        = note || null;
    await cc.save();

    // Update session counter
    await ShiftSession.findByIdAndUpdate(cc.sessionId, {
      $inc: { checkCallCount: 1 },
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

    const cc = await CheckCall.findOne({
      _id:            checkCallId,
      organisationId: orgId,
      guardId,
      response:       null,
    });
    if (!cc) return res.status(404).json({ error: 'Check call not found or already responded' });

    cc.response        = 'missed';
    cc.managerAlerted  = true;
    cc.managerAlertedAt = now;
    await cc.save();

    // Update session missed counter
    await ShiftSession.findByIdAndUpdate(cc.sessionId, {
      $inc: { missedCheckCallCount: 1 },
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
      if (siteId)    filter.siteId    = siteId;
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
  })
    .populate('guardId', 'name badgeNumber')
    .populate('siteId',  'name');
  if (!cc) return res.status(404).json({ error: 'Not found' });
  res.json({ checkCall: cc });
}));

module.exports = router;
