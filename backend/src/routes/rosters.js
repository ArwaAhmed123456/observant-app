/**
 * Roster routes
 *
 * GET    /api/rosters                — list rosters (manager: all; guard: own)
 * POST   /api/rosters                — publish/update a roster for a guard-week-site
 * GET    /api/rosters/week/:date     — all rosters for a given week start date
 * GET    /api/rosters/guard/:guardId — guard's rosters for current/specified week
 * PATCH  /api/rosters/:id            — edit an existing roster
 * DELETE /api/rosters/:id            — delete a roster
 *
 * Templates:
 * GET    /api/rosters/templates      — list templates
 * POST   /api/rosters/templates      — save template
 * DELETE /api/rosters/templates/:id  — delete template
 */
const router = require('express').Router();
const { body } = require('express-validator');
const { ShiftRoster, RosterTemplate, User, Site, PatrolCheckpoint } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const validate     = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const fcm          = require('../services/fcm');
const { audit }    = require('../utils/auditLogger');
const { getMondayOfWeek } = require('../utils/dateHelpers');

async function managerSites(user) {
  const owned = await Site.find({ organisationId: user.organisationId, managerId: user._id, active: true }).distinct('_id');
  return [...new Set([...(user.managedSiteIds || []), ...owned].map(String))];
}

// Helper to convert HH:MM into minutes from 00:00
function timeToMinutes(t) {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

function shiftInterval(day, shift) {
  const dayIndex = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(day);
  const start = timeToMinutes(shift?.start);
  const rawEnd = timeToMinutes(shift?.end);
  if (dayIndex < 0 || start === null || rawEnd === null) return null;
  const absoluteStart = dayIndex * 1440 + start;
  const absoluteEnd = dayIndex * 1440 + rawEnd + (rawEnd <= start ? 1440 : 0);
  return { start: absoluteStart, end: absoluteEnd };
}

function weeklyShiftsOverlap(firstDays, secondDays) {
  const weekMinutes = 7 * 1440;
  for (const day of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
    const first = shiftInterval(day, firstDays?.[day]);
    if (!first) continue;
    for (const otherDay of ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']) {
      const second = shiftInterval(otherDay, secondDays?.[otherDay]);
      if (!second) continue;
      for (const weekOffset of [-weekMinutes, 0, weekMinutes]) {
        if (Math.max(first.start, second.start + weekOffset) < Math.min(first.end, second.end + weekOffset)) {
          return { day, otherDay };
        }
      }
    }
  }
  return null;
}

// ── List rosters ──────────────────────────────────────────────────────────────
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { weekStartDate, guardId, siteId } = req.query;
  const orgId = req.user.organisationId;
  const filter = { organisationId: orgId };

  if (req.user.role === 'guard') {
    filter.guardId = req.user._id;
  } else if (guardId) {
    filter.guardId = guardId;
  }

  if (req.user.role === 'manager') {
    const allowed = await managerSites(req.user);
    if (siteId) {
      if (!allowed.includes(String(siteId))) {
        return res.status(403).json({ error: 'Site is outside your assigned area.' });
      }
      filter.siteId = siteId;
    } else {
      filter.siteId = { $in: allowed };
    }
  } else if (siteId) {
    filter.siteId = siteId;
  }

  if (weekStartDate) filter.weekStartDate = weekStartDate;

  const rosters = await ShiftRoster.find(filter)
    .populate('guardId', 'name badgeNumber siteId avatarUrl')
    .populate('siteId',  'name address what3words latitude longitude')
    .sort({ weekStartDate: -1 });

  res.json({ rosters });
}));

// ── Publish / update a roster ─────────────────────────────────────────────────
router.post('/',
  authenticate, requireRole('manager','admin','superadmin'),
  [
    body('guardId').isMongoId(),
    body('siteId').isMongoId(),
    body('weekStartDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('weekStartDate must be YYYY-MM-DD'),
    body('days').isObject(),
    body('checkpointIds').optional().isArray(),
    body('checkpointIds.*').optional().isMongoId(),
    body('checkCallInterval').optional().isInt({ min: 5, max: 1440 }),
    body('recurringWeekly').optional().isBoolean(),
    body('shiftInstructions').optional().isString().isLength({ max: 2000 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { guardId, siteId, weekStartDate, days } = req.body;
    const checkpointIds = [...new Set((Array.isArray(req.body.checkpointIds) ? req.body.checkpointIds : []).map(String))];
    const orgId = req.user.organisationId;
    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    for (const day of dayKeys) {
      const shift = days[day];
      if (shift == null) continue;
      if (typeof shift !== 'object' || timeToMinutes(shift.start) === null || timeToMinutes(shift.end) === null || shift.start === shift.end) {
        return res.status(400).json({ error: `Invalid ${day.toUpperCase()} shift. Use different start/end times in HH:MM format.` });
      }
    }

    const guard = await User.findOne({ _id: guardId, organisationId: orgId, role: 'guard', active: true }).select('name fcmToken siteId assignedSiteIds');
    if (!guard) return res.status(404).json({ error: 'Active guard not found in this organisation.' });

    const site = await Site.findOne({ _id: siteId, organisationId: orgId, active: true });
    if (!site) return res.status(404).json({ error: 'Site not found.' });

    if (![guard.siteId, ...(guard.assignedSiteIds || [])].some(id => String(id) === String(siteId))) return res.status(400).json({ error: 'This guard is not assigned to the selected site.' });

    if (req.user.role === 'manager' && !(await managerSites(req.user)).includes(String(siteId))) {
      return res.status(403).json({ error: 'Site is outside your assigned area.' });
    }

    if (checkpointIds.length) {
      const validCount = await PatrolCheckpoint.countDocuments({ _id: { $in: checkpointIds }, organisationId: orgId, siteId, active: true });
      if (validCount !== checkpointIds.length) return res.status(400).json({ error: 'One or more selected checkpoints are not active at this site.' });
    }

    // A short database lease serializes schedule writes for this guard, so two
    // simultaneous requests cannot both pass the overlap check before either saves.
    const lockUntil = new Date(Date.now() + 60 * 1000);
    const lock = await User.findOneAndUpdate({
      _id: guardId,
      organisationId: orgId,
      $or: [
        { rosterWriteLockUntil: { $exists: false } },
        { rosterWriteLockUntil: null },
        { rosterWriteLockUntil: { $lte: new Date() } },
      ],
    }, { $set: { rosterWriteLockUntil: lockUntil } }, { new: true });
    if (!lock) return res.status(409).json({ error: 'Another schedule for this guard is being saved. Wait a moment and try again.' });

    let roster;
    try {
      const existingOtherSiteRosters = await ShiftRoster.find({
        organisationId: orgId, guardId, weekStartDate, siteId: { $ne: siteId },
      }).populate('siteId', 'name');
      for (const other of existingOtherSiteRosters) {
        const conflict = weeklyShiftsOverlap(days, other.days);
        if (conflict) return res.status(409).json({
          error: `Shift conflict: this guard already has an overlapping shift at ${other.siteId?.name || 'another site'} (${conflict.otherDay.toUpperCase()}). Adjust the days or times before saving.`,
          conflictDay: conflict.day,
          conflictingDay: conflict.otherDay,
          conflictingSite: other.siteId?.name,
        });
      }

      roster = await ShiftRoster.findOneAndUpdate(
        { organisationId: orgId, guardId, siteId, weekStartDate },
        {
          organisationId: orgId, guardId, siteId, checkpointIds,
          publishedBy: req.user._id, weekStartDate, days,
          checkCallInterval: req.body.checkCallInterval ?? 60,
          recurringWeekly: req.body.recurringWeekly ?? true,
          shiftInstructions: String(req.body.shiftInstructions || '').trim(),
          acceptanceStatus: 'pending',
          acceptanceUpdatedAt: null,
          publishedAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } finally {
      await User.updateOne({ _id: guardId, rosterWriteLockUntil: lockUntil }, { $set: { rosterWriteLockUntil: null } });
    }

    // Send FCM push to guard
    if (guard?.fcmToken) {
      const workedDays = Object.entries(days)
        .filter(([, shift]) => shift)
        .map(([key, shift]) => `${key.charAt(0).toUpperCase() + key.slice(1)} ${shift.start}–${shift.end}`)
        .join(', ');

      await fcm.sendPush([guard.fcmToken], {
        title: '📅 Shift awaiting your response',
        body:  `Review and accept or decline your shifts at ${site.name} for week ${weekStartDate}: ${workedDays || 'None'}.`,
        data:  { type: 'roster_published', rosterId: roster._id.toString(), weekStartDate, siteId: siteId.toString() },
      });
      await ShiftRoster.findByIdAndUpdate(roster._id, { notifiedAt: new Date() });
    }

    await audit({
      req,
      action: 'roster_published',
      targetModel: 'ShiftRoster',
      targetId: roster._id,
      targetName: guard?.name || String(guardId),
      details: { siteId, weekStartDate, siteName: site.name }
    });

    const populated = await ShiftRoster.findById(roster._id)
      .populate('guardId', 'name badgeNumber avatarUrl siteId')
      .populate('siteId',  'name address what3words latitude longitude');

    res.status(201).json({ roster: populated });
  })
);

// Guard acceptance endpoint is deliberately separate from manager editing.
router.patch('/:id/acceptance', authenticate, requireRole('guard'), asyncHandler(async (req, res) => {
  const status = req.body.status;
  if (!['accepted', 'declined'].includes(status)) return res.status(400).json({ error: 'Status must be accepted or declined.' });
  const roster = await ShiftRoster.findOne({ _id: req.params.id, organisationId: req.user.organisationId, guardId: req.user._id });
  if (!roster) return res.status(404).json({ error: 'Shift assignment not found.' });
  roster.acceptanceStatus = status;
  roster.acceptanceUpdatedAt = new Date();
  await roster.save();
  await audit({ req, action: `roster_${status}`, targetModel: 'ShiftRoster', targetId: roster._id, targetName: `Roster ${roster._id}` });
  res.json({ roster });
}));

// ── Edit an existing roster ───────────────────────────────────────────────────
router.patch('/:id',
  authenticate, requireRole('manager','admin','superadmin'),
  asyncHandler(async (req, res) => {
    const allowedManagerSites = req.user.role === 'manager' ? await managerSites(req.user) : null;
    const roster = await ShiftRoster.findOne({
      _id: req.params.id,
      organisationId: req.user.organisationId,
      ...(allowedManagerSites ? { siteId: { $in: allowedManagerSites } } : {}),
    });
    if (!roster) return res.status(404).json({ error: 'Roster not found or inaccessible.' });

    if (req.body.days) {
      const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
      for (const day of dayKeys) {
        const shift = req.body.days[day];
        if (shift != null && (typeof shift !== 'object' || timeToMinutes(shift.start) === null || timeToMinutes(shift.end) === null || shift.start === shift.end)) {
          return res.status(400).json({ error: `Invalid ${day.toUpperCase()} shift. Use different start/end times in HH:MM format.` });
        }
      }
      const others = await ShiftRoster.find({ organisationId: roster.organisationId, guardId: roster.guardId, weekStartDate: roster.weekStartDate, siteId: { $ne: roster.siteId } }).populate('siteId', 'name');
      for (const other of others) {
        const conflict = weeklyShiftsOverlap(req.body.days, other.days);
        if (conflict) return res.status(409).json({ error: `Shift conflict: this guard already has an overlapping shift at ${other.siteId?.name || 'another site'}.`, conflictDay: conflict.day });
      }
      roster.days = req.body.days;
      roster.acceptanceStatus = 'pending';
      roster.acceptanceUpdatedAt = null;
    }
    if (Array.isArray(req.body.checkpointIds)) {
      roster.checkpointIds = req.body.checkpointIds;
    }
    await roster.save();

    if (req.body.days) {
      const [guard, site] = await Promise.all([
        User.findById(roster.guardId).select('name fcmToken'),
        Site.findById(roster.siteId).select('name'),
      ]);
      if (guard?.fcmToken) {
        await fcm.sendPush([guard.fcmToken], {
          title: '📅 Your shift was updated',
          body: `Your schedule at ${site?.name || 'your site'} changed. Review it and accept or decline the updated assignment.`,
          data: { type: 'roster_updated', rosterId: roster._id.toString(), weekStartDate: roster.weekStartDate, siteId: roster.siteId.toString() },
        });
        roster.notifiedAt = new Date();
        await roster.save();
      }
    }

    await audit({
      req,
      action: 'roster_edited',
      targetModel: 'ShiftRoster',
      targetId: roster._id,
      targetName: `Roster ${roster._id}`,
      details: req.body
    });

    const populated = await ShiftRoster.findById(roster._id)
      .populate('guardId', 'name badgeNumber avatarUrl siteId')
      .populate('siteId',  'name address what3words latitude longitude');

    res.json({ roster: populated });
  })
);

// ── Delete a roster ───────────────────────────────────────────────────────────
router.delete('/:id',
  authenticate, requireRole('manager','admin','superadmin'),
  asyncHandler(async (req, res) => {
    const allowedManagerSites = req.user.role === 'manager' ? await managerSites(req.user) : null;
    const roster = await ShiftRoster.findOneAndDelete({
      _id: req.params.id,
      organisationId: req.user.organisationId,
      ...(allowedManagerSites ? { siteId: { $in: allowedManagerSites } } : {}),
    });
    if (!roster) return res.status(404).json({ error: 'Roster not found or inaccessible.' });

    await audit({
      req,
      action: 'roster_deleted',
      targetModel: 'ShiftRoster',
      targetId: req.params.id,
      targetName: `Roster ${req.params.id}`
    });

    res.json({ message: 'Roster deleted successfully' });
  })
);

// ── Get week rosters ──────────────────────────────────────────────────────────
router.get('/week/:date', authenticate, asyncHandler(async (req, res) => {
  const filter = {
    organisationId: req.user.organisationId,
    weekStartDate:  req.params.date,
  };
  if (req.user.role === 'manager') {
    filter.siteId = { $in: await managerSites(req.user) };
  } else if (req.user.role === 'guard') {
    filter.guardId = req.user._id;
  }

  const rosters = await ShiftRoster.find(filter)
    .populate('guardId', 'name badgeNumber avatarUrl siteId')
    .populate('siteId',  'name address what3words latitude longitude');
  res.json({ rosters });
}));

// ── Get guard's rosters for a week (supports multiple sites) ──────────────────
router.get('/guard/:guardId', authenticate, asyncHandler(async (req, res) => {
  const { week } = req.query;
  const weekStartDate = week || getMondayOfWeek();

  const filter = {
    organisationId: req.user.organisationId,
    guardId:        req.params.guardId,
    weekStartDate,
  };
  if (req.user.role === 'guard' && String(req.user._id) !== String(req.params.guardId)) {
    return res.status(403).json({ error: 'You can only view your own schedule.' });
  }
  if (req.user.role === 'manager') {
    filter.siteId = { $in: await managerSites(req.user) };
  }
  const rosters = await ShiftRoster.find(filter).populate('siteId', 'name address what3words latitude longitude');

  res.json({
    rosters,
    roster: rosters[0] || null,
    weekStartDate
  });
}));

// ════════════════════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════════════════════

router.get('/templates', authenticate, requireRole('manager','admin','superadmin'),
  asyncHandler(async (req, res) => {
    const templates = await RosterTemplate.find({
      organisationId: req.user.organisationId,
    }).populate('guardId', 'name').sort({ name: 1 });
    res.json({ templates });
  })
);

router.post('/templates',
  authenticate, requireRole('manager','admin','superadmin'),
  [
    body('name').trim().notEmpty(),
    body('days').isObject(),
    body('checkpointIds').optional().isArray(),
    body('checkpointIds.*').optional().isMongoId(),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, days, guardId } = req.body;
    const checkpointIds = [...new Set((Array.isArray(req.body.checkpointIds) ? req.body.checkpointIds : []).map(String))];
    if (checkpointIds.length) {
      const filter = { _id: { $in: checkpointIds }, organisationId: req.user.organisationId, active: true };
      if (req.user.role === 'manager') filter.siteId = { $in: await managerSites(req.user) };
      const validCount = await PatrolCheckpoint.countDocuments(filter);
      if (validCount !== checkpointIds.length) return res.status(400).json({ error: 'One or more template checkpoints are not active in this organisation.' });
    }
    const template = await RosterTemplate.create({
      organisationId: req.user.organisationId,
      createdBy:      req.user._id,
      name,
      days,
      checkpointIds,
      guardId:        guardId || null,
    });
    res.status(201).json({ template });
  })
);

router.delete('/templates/:id',
  authenticate, requireRole('manager','admin','superadmin'),
  asyncHandler(async (req, res) => {
    const filter = { _id: req.params.id, organisationId: req.user.organisationId };
    if (req.user.role === 'manager') filter.createdBy = req.user._id;
    await RosterTemplate.findOneAndDelete(filter);
    res.json({ message: 'Template deleted' });
  })
);

module.exports = router;
