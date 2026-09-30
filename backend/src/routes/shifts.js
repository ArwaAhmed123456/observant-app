/**
 * Shift Session routes
 *
 * POST /api/shifts/book-on       — guard books on
 * POST /api/shifts/book-off      — guard books off
 * GET  /api/shifts/active        — get caller's active session
 * GET  /api/shifts               — list sessions (manager: all; guard: own)
 * GET  /api/shifts/:id           — get one session
 */
const router = require('express').Router();
const { body } = require('express-validator');
const { ShiftSession, ShiftRoster, PatrolSession, User } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate     = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { dayKey, punctualityMinutes, getPunctualityLabel } = require('../utils/dateHelpers');
const { createAlert } = require('../services/alertService');

// ── Book On ───────────────────────────────────────────────────────────────────
router.post('/book-on',
  authenticate, requireRole('guard'),
  asyncHandler(async (req, res) => {
    const { siteId } = req.body;
    const guardId = req.user._id;
    const orgId   = req.user.organisationId;
    const now     = new Date();
    const assignedSiteId = req.user.siteId;
    if (!assignedSiteId || (siteId && String(siteId) !== String(assignedSiteId))) {
      return res.status(403).json({ error: 'Book on only at your assigned site.' });
    }

    // Close any stale open session
    await ShiftSession.updateMany(
      { organisationId: orgId, guardId, bookedOffAt: null },
      { bookedOffAt: now, autoEnded: true }
    );

    // Find today's roster for punctuality
    const { getMondayOfWeek } = require('../utils/dateHelpers');
    const weekStart = getMondayOfWeek(now);
    const roster = await ShiftRoster.findOne({
      organisationId: orgId,
      guardId,
      weekStartDate: weekStart,
    });
    const todayShift = roster?.days?.[dayKey(now)];
    const scheduledStart = todayShift?.start || null;
    const scheduledEnd   = todayShift?.end   || null;

    let punctuality = 'unscheduled';
    let diffMins    = 0;
    if (scheduledStart) {
      diffMins    = punctualityMinutes(now, scheduledStart, now);
      punctuality = getPunctualityLabel(diffMins);
    }

    const session = await ShiftSession.create({
      organisationId:     orgId,
      guardId,
      siteId:             assignedSiteId,
      rosterId:           roster?._id || null,
      bookedOnAt:         now,
      scheduledStart,
      scheduledEnd,
      scheduledEndAt: req.body.scheduledEndAt ? new Date(req.body.scheduledEndAt) : null,
      nextCheckCallAt: new Date(now.getTime() + 60 * 60 * 1000),
      nextRandomPromptAt: null,
      punctuality,
      punctualityMinutes: diffMins,
    });

    // Alert manager if late > 15 min
    if (punctuality === 'late') {
      const guard = await User.findById(guardId).select('name badgeNumber');
      await createAlert({
        organisationId: orgId,
        siteId:  session.siteId,
        guardId,
        type:    'guard_booked_late',
        title:   'Guard booked on late',
        message: `${guard.name} (${guard.badgeNumber}) booked on ${diffMins} minutes late.`,
        refModel:'ShiftSession',
        refId:   session._id,
      });
    }

    res.status(201).json({ session });
  })
);

// ── Book Off ──────────────────────────────────────────────────────────────────
router.post('/book-off',
  authenticate, requireRole('guard'),
  asyncHandler(async (req, res) => {
    const activePatrol = await PatrolSession.findOne({
      organisationId: req.user.organisationId,
      guardId: req.user._id,
      status: 'in_progress',
    }).select('_id');
    if (activePatrol) return res.status(409).json({ error: 'Finish your active patrol before booking off.' });
    const session = await ShiftSession.findOneAndUpdate(
      { organisationId: req.user.organisationId, guardId: req.user._id, bookedOffAt: null },
      { bookedOffAt: new Date(), nextCheckCallAt: null, nextRandomPromptAt: null },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'No active session found' });
    res.json({ session });
  })
);

// ── Get active session ────────────────────────────────────────────────────────
router.get('/active',
  authenticate,
  asyncHandler(async (req, res) => {
    const guardId = req.user.role === 'guard'
      ? req.user._id
      : req.query.guardId;

    const session = await ShiftSession.findOne({
      organisationId: req.user.organisationId,
      guardId,
      bookedOffAt: null,
    }).populate('siteId', 'name address');

    res.json({ session: session || null });
  })
);

// ── List sessions ─────────────────────────────────────────────────────────────
router.get('/',
  authenticate,
  asyncHandler(async (req, res) => {
    const { guardId, siteId, from, to, limit = 50, page = 1 } = req.query;
    const orgId = req.user.organisationId;

    const filter = { organisationId: orgId };

    if (req.user.role === 'guard') {
      filter.guardId = req.user._id;
    } else {
      if (guardId) filter.guardId = guardId;
      if (req.user.role === 'manager') {
        const allowedSites = req.user.managedSiteIds.map(String);
        if (siteId && !allowedSites.includes(String(siteId))) filter.siteId = null;
        else filter.siteId = siteId || { $in: req.user.managedSiteIds };
      } else if (siteId) filter.siteId = siteId;
    }

    if (from || to) {
      filter.bookedOnAt = {};
      if (from) filter.bookedOnAt.$gte = new Date(from);
      if (to)   filter.bookedOnAt.$lte = new Date(to);
    }

    const [sessions, total] = await Promise.all([
      ShiftSession.find(filter)
        .sort({ bookedOnAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('guardId', 'name badgeNumber')
        .populate('siteId',  'name'),
      ShiftSession.countDocuments(filter),
    ]);

    res.json({ sessions, total, page: Number(page), limit: Number(limit) });
  })
);

// ── Get one session ───────────────────────────────────────────────────────────
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const session = await ShiftSession.findOne({
    _id: req.params.id,
    organisationId: req.user.organisationId,
    ...(req.user.role === 'guard' ? { guardId: req.user._id } : {}),
    ...(req.user.role === 'manager' ? { siteId: { $in: req.user.managedSiteIds } } : {}),
  })
    .populate('guardId', 'name badgeNumber avatarUrl')
    .populate('siteId',  'name address');

  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
}));

module.exports = router;
