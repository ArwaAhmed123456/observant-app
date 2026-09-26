/**
 * Roster routes
 *
 * GET    /api/rosters                — list rosters (manager: all; guard: own)
 * POST   /api/rosters                — publish/update a roster for a guard-week
 * GET    /api/rosters/week/:date     — all rosters for a given week start date
 * GET    /api/rosters/guard/:guardId — guard's roster for current/specified week
 *
 * Templates:
 * GET    /api/rosters/templates      — list templates
 * POST   /api/rosters/templates      — save template
 * DELETE /api/rosters/templates/:id  — delete template
 */
const router = require('express').Router();
const { body } = require('express-validator');
const { ShiftRoster, RosterTemplate, User } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate     = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const fcm          = require('../services/fcm');

// ── List rosters ──────────────────────────────────────────────────────────────
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { weekStartDate, guardId } = req.query;
  const orgId = req.user.organisationId;
  const filter = { organisationId: orgId };

  if (req.user.role === 'guard') {
    filter.guardId = req.user._id;
  } else if (guardId) {
    filter.guardId = guardId;
  }
  if (weekStartDate) filter.weekStartDate = weekStartDate;

  const rosters = await ShiftRoster.find(filter)
    .populate('guardId', 'name badgeNumber siteId')
    .populate('siteId',  'name')
    .sort({ weekStartDate: -1 });

  res.json({ rosters });
}));

// ── Publish / update a roster ─────────────────────────────────────────────────
router.post('/',
  authenticate, requireRole('manager','admin'),
  [
    body('guardId').isMongoId(),
    body('siteId').isMongoId(),
    body('weekStartDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('weekStartDate must be YYYY-MM-DD'),
    body('days').isObject(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { guardId, siteId, weekStartDate, days } = req.body;
    const orgId = req.user.organisationId;

    const roster = await ShiftRoster.findOneAndUpdate(
      { organisationId: orgId, guardId, weekStartDate },
      {
        organisationId: orgId,
        guardId,
        siteId,
        publishedBy:    req.user._id,
        weekStartDate,
        days,
        publishedAt:    new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send FCM push to guard
    const guard = await User.findById(guardId).select('name fcmToken');
    if (guard?.fcmToken) {
      const workedDays = Object.entries(days)
        .filter(([, v]) => v)
        .map(([k]) => k.charAt(0).toUpperCase() + k.slice(1))
        .join(', ');

      await fcm.sendPush([guard.fcmToken], {
        title: '📅 Your schedule is ready',
        body:  `Your shifts for the week of ${weekStartDate} have been published (${workedDays}).`,
        data:  { type: 'roster_published', rosterId: roster._id.toString(), weekStartDate },
      });
      await ShiftRoster.findByIdAndUpdate(roster._id, { notifiedAt: new Date() });
    }

    res.status(201).json({ roster });
  })
);

// ── Get week rosters ──────────────────────────────────────────────────────────
router.get('/week/:date', authenticate, asyncHandler(async (req, res) => {
  const rosters = await ShiftRoster.find({
    organisationId: req.user.organisationId,
    weekStartDate:  req.params.date,
  })
    .populate('guardId', 'name badgeNumber avatarUrl siteId')
    .populate('siteId',  'name');
  res.json({ rosters });
}));

// ── Get guard's roster for a week ─────────────────────────────────────────────
router.get('/guard/:guardId', authenticate, asyncHandler(async (req, res) => {
  const { week } = req.query; // YYYY-MM-DD of Monday, defaults to current week
  const { getMondayOfWeek } = require('../utils/dateHelpers');
  const weekStartDate = week || getMondayOfWeek();

  const roster = await ShiftRoster.findOne({
    organisationId: req.user.organisationId,
    guardId:        req.params.guardId,
    weekStartDate,
  }).populate('siteId', 'name address');

  res.json({ roster: roster || null, weekStartDate });
}));

// ════════════════════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════════════════════

router.get('/templates', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const templates = await RosterTemplate.find({
      organisationId: req.user.organisationId,
    }).populate('guardId', 'name').sort({ name: 1 });
    res.json({ templates });
  })
);

router.post('/templates',
  authenticate, requireRole('manager','admin'),
  [
    body('name').trim().notEmpty(),
    body('days').isObject(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, days, guardId } = req.body;
    const template = await RosterTemplate.create({
      organisationId: req.user.organisationId,
      createdBy:      req.user._id,
      name,
      days,
      guardId:        guardId || null,
    });
    res.status(201).json({ template });
  })
);

router.delete('/templates/:id',
  authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    await RosterTemplate.findOneAndDelete({
      _id: req.params.id, organisationId: req.user.organisationId,
    });
    res.json({ message: 'Template deleted' });
  })
);

module.exports = router;
