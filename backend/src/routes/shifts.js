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
const { ShiftSession, ShiftRoster, PatrolSession, User, Site, Alert } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const {
  dayKey,
  punctualityMinutes,
  getPunctualityLabel,
  getMondayOfWeek,
  calculateShiftEndDateTime,
  parseTimeOnDate
} = require('../utils/dateHelpers');
const { createAlert } = require('../services/alertService');
const { audit } = require('../utils/auditLogger');

async function managerSites(user) {
  const owned = await Site.find({
    organisationId: user.organisationId,
    managerId: user._id,
    active: true,
  }).distinct('_id');
  return [...new Set([...(user.managedSiteIds || []), ...owned].map(String))];
}

// ── Book On ───────────────────────────────────────────────────────────────────
router.post('/book-on',
  authenticate, requireRole('guard'),
  asyncHandler(async (req, res) => {
    const { siteId, latitude, longitude } = req.body;
    const guardId = req.user._id;
    const orgId = req.user.organisationId;
    const now = new Date();

    // Determine target site (allow assigned site or specified scheduled site)
    const targetSiteId = siteId || req.user.siteId;
    if (!targetSiteId) {
      return res.status(400).json({ error: 'No site specified for book on.' });
    }
    if (![req.user.siteId, ...(req.user.assignedSiteIds || [])].some(id => String(id) === String(targetSiteId))) return res.status(403).json({ error: 'You are not assigned to this site.' });

    const site = await Site.findById(targetSiteId);
    if (!site) return res.status(404).json({ error: 'Site not found.' });

    // Validate geofence boundary if site has coordinates defined
    const siteLat = site.latitude != null ? Number(site.latitude) : (site.location?.coordinates?.[1] ? Number(site.location.coordinates[1]) : null);
    const siteLng = site.longitude != null ? Number(site.longitude) : (site.location?.coordinates?.[0] ? Number(site.location.coordinates[0]) : null);
    const allowedRadius = site.geofenceRadiusMetres || 250;

    let distanceMetres = null;
    if (siteLat != null && siteLng != null) {
      if (latitude == null || longitude == null) {
        return res.status(400).json({
          error: 'GPS location is required to verify your presence on site before booking on. Please ensure location services are enabled.',
          code: 'LOCATION_REQUIRED',
        });
      }
      const rad = deg => deg * Math.PI / 180;
      const lat1 = Number(latitude), lon1 = Number(longitude);
      const dLat = rad(siteLat - lat1), dLon = rad(siteLng - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(siteLat)) * Math.sin(dLon / 2) ** 2;
      distanceMetres = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

      if (distanceMetres > allowedRadius) {
        return res.status(403).json({
          error: `You are approximately ${distanceMetres}m away from ${site.name}. You must be physically within the defined site boundary (${allowedRadius}m) to book on.`,
          code: 'OUTSIDE_GEOFENCE',
          distance: distanceMetres,
          allowedRadius,
        });
      }
    }

    const activeAtAnotherSite = await ShiftSession.findOne({
      organisationId: orgId, guardId, bookedOffAt: null, siteId: { $ne: targetSiteId },
    }).populate('siteId', 'name');
    if (activeAtAnotherSite) return res.status(409).json({
      error: `You are already booked on at ${activeAtAnotherSite.siteId?.name || 'another site'}. Book off before starting a shift at this site.`,
      activeSiteId: String(activeAtAnotherSite.siteId?._id || activeAtAnotherSite.siteId || ''),
    });

    // Find roster for this week and site
    const weekStart = getMondayOfWeek(now);
    let roster = await ShiftRoster.findOne({
      organisationId: orgId,
      guardId,
      siteId: targetSiteId,
      weekStartDate: weekStart,
    });
    if (!roster) {
      roster = await ShiftRoster.findOne({
        organisationId: orgId, guardId, siteId: targetSiteId,
        recurringWeekly: true, weekStartDate: { $lt: weekStart },
      }).sort({ weekStartDate: -1 });
    }

    const todayShift = roster?.days?.[dayKey(now)];
    const scheduledStart = todayShift?.start || null;
    const scheduledEnd = todayShift?.end || null;

    if (!roster || !scheduledStart || !scheduledEnd) {
      return res.status(409).json({ error: 'No duty is scheduled for you at this site today.', code: 'NO_DUTY_SCHEDULED' });
    }
    if (roster.acceptanceStatus === 'declined') {
      return res.status(409).json({ error: 'You declined this shift. Contact your manager to arrange duty.', code: 'SHIFT_DECLINED' });
    }
    if (roster.acceptanceStatus !== 'accepted') {
      return res.status(409).json({ error: 'Accept this shift in My Schedule before booking on.', code: 'SHIFT_NOT_ACCEPTED' });
    }

    const shiftStartAt = parseTimeOnDate(scheduledStart, now);
    const opensAt = new Date(shiftStartAt.getTime() - 15 * 60 * 1000);
    const shiftEndAt = calculateShiftEndDateTime(scheduledStart, scheduledEnd, now);
    if (now < opensAt) {
      return res.status(409).json({
        error: 'Book-on opens 15 minutes before your scheduled shift.',
        code: 'BOOK_ON_TOO_EARLY', opensAt: opensAt.toISOString(), scheduledStartAt: shiftStartAt.toISOString(),
      });
    }
    if (now > shiftEndAt) {
      return res.status(409).json({ error: 'Your scheduled shift has ended. Contact your manager.', code: 'SHIFT_WINDOW_ENDED' });
    }

    const diffMins = punctualityMinutes(now, scheduledStart, now);
    const punctuality = getPunctualityLabel(diffMins);

    // Close any previous stale open session for this guard at this site
    await ShiftSession.updateMany(
      { organisationId: orgId, guardId, siteId: targetSiteId, bookedOffAt: null },
      { bookedOffAt: now, autoEnded: true }
    );

    // Calculate scheduled end timestamp in UK time
    const scheduledEndAt = shiftEndAt;

    const session = await ShiftSession.create({
      organisationId: orgId,
      guardId,
      siteId: targetSiteId,
      rosterId: roster?._id || null,
      bookedOnAt: now,
      scheduledStart,
      scheduledEnd,
      scheduledEndAt,
      nextCheckCallAt: new Date(now.getTime() + 60 * 60 * 1000),
      // Schedule exactly 2 random surprise patrols per shift:
      // First prompt: randomly between 1.5h and 4.5h from book-on
      nextRandomPromptAt: new Date(now.getTime() + (1.5 + Math.random() * 3.0) * 60 * 60 * 1000),
      randomPromptCount: 0,
      punctuality,
      punctualityMinutes: diffMins,
    });

    // Alert manager immediately if guard arrived late
    if (punctuality === 'late' || punctuality === 'slightly_late' || diffMins > 0) {
      const guard = await User.findById(guardId).select('name badgeNumber');
      const site = await Site.findById(session.siteId).select('name');
      await createAlert({
        organisationId: orgId,
        siteId: session.siteId,
        guardId,
        type: 'guard_booked_late',
        title: '🚨 Guard arrived on site late',
        message: `${guard?.name || 'Guard'} (${guard?.badgeNumber || 'N/A'}) arrived and booked on ${diffMins} minute(s) late for scheduled ${scheduledStart} shift at ${site?.name || 'Site'}.`,
        refModel: 'ShiftSession',
        refId: session._id,
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
      await audit({
        req,
        action: 'early_book_off',
        targetModel: 'ShiftSession',
        targetId: session._id,
        targetName: `Shift for guard ${session.guardId}`,
        details: {
          scheduledEnd: session.scheduledEnd,
          scheduledEndAt: endAt,
          actualBookOff: now,
          overrideReason: req.body.overrideReason || 'Guard book off / sign out',
          approvedBy: req.body.overrideApprovedBy || req.user.name,
        }
      });
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
        const allowedSites = await managerSites(req.user);
        if (siteId && !allowedSites.includes(String(siteId))) filter.siteId = null;
        else filter.siteId = siteId || { $in: allowedSites };
      } else if (siteId) filter.siteId = siteId;
    }

    if (from || to) {
      filter.bookedOnAt = {};
      if (from) filter.bookedOnAt.$gte = new Date(from);
      if (to) filter.bookedOnAt.$lte = new Date(to);
    }

    const [sessions, total] = await Promise.all([
      ShiftSession.find(filter)
        .sort({ bookedOnAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate('guardId', 'name badgeNumber')
        .populate('siteId', 'name what3words latitude longitude'),
      ShiftSession.countDocuments(filter),
    ]);

    res.json({ sessions, total, page: Number(page), limit: Number(limit) });
  })
);

// ── Get one session ───────────────────────────────────────────────────────────
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const allowedManagerSites = req.user.role === 'manager' ? await managerSites(req.user) : null;
  const session = await ShiftSession.findOne({
    _id: req.params.id,
    organisationId: req.user.organisationId,
    ...(req.user.role === 'guard' ? { guardId: req.user._id } : {}),
    ...(allowedManagerSites ? { siteId: { $in: allowedManagerSites } } : {}),
  })
    .populate('guardId', 'name badgeNumber avatarUrl')
    .populate('siteId', 'name address what3words latitude longitude');

  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ session });
}));

// ── Edit/Update shift session ─────────────────────────────────────────────────
router.patch('/:id',
  authenticate, requireRole('manager', 'admin', 'superadmin'),
  asyncHandler(async (req, res) => {
    const allowedManagerSites = req.user.role === 'manager' ? await managerSites(req.user) : null;
    const session = await ShiftSession.findOne({
      _id: req.params.id,
      organisationId: req.user.organisationId,
      ...(allowedManagerSites ? { siteId: { $in: allowedManagerSites } } : {}),
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
      .populate('siteId', 'name address what3words latitude longitude');

    res.json({ session: updated });
  })
);

// ── Geofence breach monitor ──────────────────────────────────────────────────
router.post('/geofence-breach',
  authenticate, requireRole('guard'),
  asyncHandler(async (req, res) => {
    const { latitude, longitude, siteId } = req.body;
    const guardId = req.user._id;
    const orgId = req.user.organisationId;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'GPS coordinates are required.' });
    }

    const session = await ShiftSession.findOne({
      organisationId: orgId,
      guardId,
      bookedOffAt: null,
      ...(siteId ? { siteId } : {}),
    }).populate('siteId');

    if (!session || !session.siteId) {
      return res.status(200).json({ status: 'no_active_session' });
    }

    const site = session.siteId;
    const siteLat = site.latitude != null ? Number(site.latitude) : (site.location?.coordinates?.[1] ? Number(site.location.coordinates[1]) : null);
    const siteLng = site.longitude != null ? Number(site.longitude) : (site.location?.coordinates?.[0] ? Number(site.location.coordinates[0]) : null);
    const allowedRadius = site.geofenceRadiusMetres || 250;

    if (siteLat == null || siteLng == null) {
      return res.status(200).json({ status: 'no_site_coords' });
    }

    const rad = deg => deg * Math.PI / 180;
    const lat1 = Number(latitude), lon1 = Number(longitude);
    const dLat = rad(siteLat - lat1), dLon = rad(siteLng - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(siteLat)) * Math.sin(dLon / 2) ** 2;
    const distance = Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

    if (distance > allowedRadius) {
      // Throttle: notify managers at most once every 15 minutes per guard/shift to avoid flooding
      const recent = await Alert.findOne({
        organisationId: orgId,
        guardId,
        type: 'geofence_warning',
        createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) },
      });

      if (!recent) {
        const guard = await User.findById(guardId).select('name badgeNumber');
        await createAlert({
          organisationId: orgId,
          siteId: site._id,
          guardId,
          type: 'geofence_warning',
          title: '🚨 Guard Left Site Boundary',
          message: `${guard?.name || 'Guard'} (${guard?.badgeNumber || 'N/A'}) has moved outside the designated parameter of ${site.name} (currently ${distance}m away; boundary is ${allowedRadius}m).`,
          location: { latitude: lat1, longitude: lon1 },
          refModel: 'ShiftSession',
          refId: session._id,
        });
        return res.status(200).json({ breached: true, alertCreated: true, distance, allowedRadius });
      }
      return res.status(200).json({ breached: true, alertCreated: false, distance, allowedRadius, throttled: true });
    }

    return res.status(200).json({ breached: false, distance, allowedRadius });
  })
);

module.exports = router;
