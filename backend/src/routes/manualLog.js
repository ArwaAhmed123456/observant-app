/**
 * Manual Log routes — manager logs check calls or patrols on behalf of a guard
 *
 * POST /api/manual-log/check-call
 * POST /api/manual-log/patrol
 */
const router = require('express').Router();
const { body } = require('express-validator');
const { CheckCall, PatrolSession, ShiftSession, User } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate     = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { audit }    = require('../utils/auditLogger');

// ── Manual check call ─────────────────────────────────────────────────────────
router.post('/check-call',
  authenticate, requireRole('manager', 'admin'),
  [
    body('guardId').isMongoId(),
    body('response').isIn(['yes', 'no', 'missed']),
    body('firedAt').optional().isISO8601(),
    body('note').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { guardId, response, note, firedAt } = req.body;
    const orgId = req.user.organisationId;

    const guard   = await User.findOne({ _id: guardId, organisationId: orgId }).select('name badgeNumber siteId');
    if (!guard) return res.status(404).json({ error: 'Guard not found in this organisation' });

    // Find or note session
    const session = await ShiftSession.findOne({ organisationId: orgId, guardId, bookedOffAt: null });

    const now = firedAt ? new Date(firedAt) : new Date();

    const cc = await CheckCall.create({
      organisationId:    orgId,
      sessionId:         session?._id || null,
      guardId,
      siteId:            guard.siteId,
      firedAt:           now,
      expiresAt:         new Date(now.getTime() + 10 * 60000),
      respondedAt:       now,
      response,
      note:              note || null,
      manuallyLoggedBy:  req.user._id,   // extra field — add to schema below
      isManualLog:       true,
    });

    await audit({
      req,
      organisationId: orgId,
      action:      'manual_log_check_call',
      targetModel: 'CheckCall',
      targetId:    cc._id,
      targetName:  guard.name,
      details:     { response, note, firedAt: now },
    });

    res.status(201).json({ checkCall: cc });
  })
);

// ── Manual patrol ─────────────────────────────────────────────────────────────
router.post('/patrol',
  authenticate, requireRole('manager', 'admin'),
  [
    body('guardId').isMongoId(),
    body('startedAt').optional().isISO8601(),
    body('finishedAt').optional().isISO8601(),
    body('note').optional().trim().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { guardId, startedAt, finishedAt, note } = req.body;
    const orgId = req.user.organisationId;

    const guard   = await User.findOne({ _id: guardId, organisationId: orgId }).select('name badgeNumber siteId');
    if (!guard) return res.status(404).json({ error: 'Guard not found' });

    const session = await ShiftSession.findOne({ organisationId: orgId, guardId, bookedOffAt: null });
    const now     = new Date();

    const patrol = await PatrolSession.create({
      organisationId:   orgId,
      shiftSessionId:   session?._id || null,
      guardId,
      siteId:           guard.siteId,
      startedAt:        startedAt  ? new Date(startedAt)  : now,
      finishedAt:       finishedAt ? new Date(finishedAt) : now,
      status:           'complete',
      isManualLog:      true,
      manuallyLoggedBy: req.user._id,
      captures:         [],
    });

    await audit({
      req,
      organisationId: orgId,
      action:      'manual_log_patrol',
      targetModel: 'PatrolSession',
      targetId:    patrol._id,
      targetName:  guard.name,
      details:     { startedAt, finishedAt, note },
    });

    res.status(201).json({ patrol });
  })
);

module.exports = router;
