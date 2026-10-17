/**
 * Shift Session routes
 *
 * POST  /api/shifts/book-on       — guard books on
 * POST  /api/shifts/book-off      — guard books off (blocked before shift end time unless override)
 * GET   /api/shifts/active        — get caller's active session
 * GET   /api/shifts               — list sessions (manager: all; guard: own)
 * GET   /api/shifts/:id           — get one session
 * PATCH /api/shifts/:id           — update/edit shift session (manager/admin/superadmin)
 */
const router = require('express').Router();
const { body } = require('express-validator');
const { ShiftSession, ShiftRoster, PatrolSession, User } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate     = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const {
  dayKey,
  punctualityMinutes,
  getPunctualityLabel,
  getMondayOfWeek,
  calculateShiftEndDateTime
} = require('../utils/dateHelpers');
const { createAlert } = require('../services/alertService');
const { audit } = require('../utils/auditLogger');

// ── Book On ───────────────────────────────────────────────────────────────────
router.post('/book-on',
  authenticate, requireRole('guard'),
  asyncHandler(async (req, res) => {
    const { siteId } = req.body;
    const guardId = req.user._id;
    const orgId   = req.user.organisationId;
    const now     = new Date();
    
    // Determine target site (allow assigned site or specified scheduled site)
    const targetSiteId = siteId || req.user.siteId;
    if (!targetSiteId) {
      return res.status(400).json({ error: 'No site specified for book on.' });
    }

    // Find roster for this week and site
    const weekStart = getMondayOfWeek(now);
    let roster = await ShiftRoster.findOne({
      organisationId: orgId,
      guardId,
      siteId: targetSiteId,
      weekStartDate: weekStart,
    });

    // Fallback: Check if there's any active roster for this guard this week
    if (!roster) {
      roster = await ShiftRoster.findOne({
        organisationId: orgId,
        guardId,
        weekStartDate: weekStart,
      });
    }

    const todayShift = roster?.days?.[dayKey(now)];
    const scheduledStart = todayShift?.start || null;
    const scheduledEnd   = todayShift?.end   || null;

    let punctuality = 'unscheduled';
    let diffMins    = 0;
    if (scheduledStart) {
      diffMins    = punctualityMinutes(now, scheduledStart, now);
      punctuality = getPunctualityLabel(diffMins);
    }

    // Close any previous stale open session for this guard at this site
    await ShiftSession.updateMany(
      { organisationId: orgId, guardId, siteId: targetSiteId, bookedOffAt: null },
      { bookedOffAt: now, autoEnded: true }
    );

    // Calculate scheduled end timestamp in UK time
    const calculatedEndAt = calculateShiftEndDateTime(scheduledStart, scheduledEnd, now);
    const scheduledEndAt = calculatedEndAt || (req.body.scheduledEndAt ? new Date(req.body.scheduledEndAt) : null);

    const session = await ShiftSession.create({
      organisationId:     orgId,
      guardId,
      siteId:             targetSiteId,
      rosterId:           roster?._id || null,
      bookedOnAt:         now,
      scheduledStart,
      scheduledEnd,
      scheduledEndAt,
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
        message: `${guard?.name || 'Guard'} (${guard?.badgeNumber || 'N/A'}) booked on ${diffMins} minutes late.`,
        refModel:'ShiftSession',
        refId:   session._id,
      });
    }

    await audit({
      req,
      action: 'shift_booked_on',
      targetModel: 'ShiftSession',
      targetId: session._id,
      targetName: req.user.name,
      details: { siteId: targetSiteId, punctuality, diffMins }
    });

    res.status(201).json({ session });
  })
);

// ── Book Off ──────────────────────────────────────────────────────────────────
router.post('/book-off',
  authenticate,
  asyncHandler(async (req, res) => {
    const isGuard = req.user.role === 'guard';
    const filter = { organisationId: req.user.organisationId, bookedOffAt: null };
    
    if (isGuard) {
      filter.guardId = req.user._id;
    }
    if (req.body.sessionId) {
      filter._id = req.body.sessionId;
    } else if (req.body.siteId) {
      filter.siteId = req.body.siteId;
    }

    const session = await ShiftSession.findOne(filter);
    if (!session) return res.status(404).json({ error: 'No active session found to book off.' });

    // Active patrol check
    const activePatrol = await PatrolSession.findOne({
      organisationId: req.user.organisationId,
      guardId: session.guardId,
      status: 'in_progress',
    }).select('_id');
    if (activePatrol) {
      return res.status(409).json({ error: 'Finish your active patrol before booking off.' });
    }

    // Scheduled end time enforcement (UK time)
    let endAt = session.scheduledEndAt;
    if (!endAt && session.scheduledEnd) {
      endAt = calculateShiftEndDateTime(session.scheduledStart, session.scheduledEnd, session.bookedOnAt);
    }

    const now = new Date();
    const isEarly = endAt && now.getTime() < endAt.getTime();

    if (isEarly) {
      const isManagerOrAdmin = ['manager', 'admin', 'superadmin'].includes(req.user.role);
      const hasOverride = req.body.override === true || req.body.isOverride === true;

      if (isManagerOrAdmin || (hasOverride && req.body.overrideApprovedBy)) {
        // Log authorized override
        await audit({
          req,
          action: 'early_book_off_override',
          targetModel: 'ShiftSession',
          targetId: session._id,
          targetName: `Shift for guard ${session.guardId}`,
          details: {
            scheduledEnd: session.scheduledEnd,
            scheduledEndAt: endAt,
            actualBookOff: now,
            overrideReason: req.body.overrideReason || 'Authorized supervisor override',
            approvedBy: req.body.overrideApprovedBy || req.user.name,
          }
        });
      } else {
        return res.status(400).json({
          error: 'You cannot book off before your time.',
          code: 'EARLY_BOOK_OFF_BLOCKED',
          scheduledEnd: session.scheduledEnd,
          scheduledEndAt: endAt,
          currentTime: now
        });
      }
    }

    session.bookedOffAt = now;
    session.nextCheckCallAt = null;
    session.nextRandomPromptAt = null;
    await session.save();

    await audit({
      req,
      action: 'shift_booked_off',
      targetModel: 'ShiftSession',
      targetId: session._id,
      targetName: req.user.name,
      details: { siteId: session.siteId, bookedOffAt: now }
    });

    res.json({ session });
  })
);

// ── Get active session(s) ─────────────────────────────────────────────────────
router.get('/active',
  authenticate,
  asyncHandler(async (req, res) => {
    const guardId = req.user.role === 'guard'
      ? req.user._id
      : req.query.guardId;

    const filter = {
      organisationId: req.user.organisationId,
      bookedOffAt: null,
    };
    if (guardId) filter.guardId = guardId;
    if (req.query.siteId) filter.siteId = req.query.siteId;

    const session = await ShiftSession.findOne(filter)
      .populate('siteId', 'name address what3words latitude longitude');

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
        .populate('siteId',  'name what3words latitude longitude'),
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
    .populate('siteId',  'name address what3words latitude longitude');

  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
}));

// ── Edit/Update shift session ─────────────────────────────────────────────────
router.patch('/:id',
  authenticate, requireRole('manager', 'admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const session = await ShiftSession.findOne({
      _id: req.params.id,
      organisationId: req.user.organisationId,
      ...(req.user.role === 'manager' ? { siteId: { $in: req.user.managedSiteIds } } : {}),
    });
    if (!session) return res.status(404).json({ error: 'Shift session not found or inaccessible.' });

    const allowed = [
      'scheduledStart', 'scheduledEnd', 'scheduledEndAt',
      'bookedOnAt', 'bookedOffAt', 'punctuality', 'punctualityMinutes',
      'siteId', 'guardId'
    ];
    allowed.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field.endsWith('At') && req.body[field]) {
          session[field] = new Date(req.body[field]);
        } else {
          session[field] = req.body[field];
        }
      }
    });

    await session.save();
    await audit({
      req,
      action: 'shift_edited',
      targetModel: 'ShiftSession',
      targetId: session._id,
      targetName: `Shift ${session._id}`,
      details: req.body
    });

    const updated = await ShiftSession.findById(session._id)
      .populate('guardId', 'name badgeNumber avatarUrl')
      .populate('siteId',  'name address what3words latitude longitude');

    res.json({ session: updated });
  })
);

module.exports = router;
