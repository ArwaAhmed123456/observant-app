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

// Helper to convert HH:MM into minutes from 00:00
function timeToMinutes(t) {
  if (!t || !/^\d{2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Helper to check if two shift times on the same day overlap
function shiftsOverlap(s1, s2) {
  if (!s1 || !s2 || !s1.start || !s1.end || !s2.start || !s2.end) return false;
  let start1 = timeToMinutes(s1.start);
  let end1 = timeToMinutes(s1.end);
  let start2 = timeToMinutes(s2.start);
  let end2 = timeToMinutes(s2.end);
  if (start1 === null || end1 === null || start2 === null || end2 === null) return false;

  // Handle overnight shift by extending end into next 24h
  if (end1 <= start1) end1 += 24 * 60;
  if (end2 <= start2) end2 += 24 * 60;

  return Math.max(start1, start2) < Math.min(end1, end2);
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
    const allowed = req.user.managedSiteIds.map(String);
    if (siteId) {
      if (!allowed.includes(String(siteId))) {
        return res.status(403).json({ error: 'Site is outside your assigned area.' });
      }
      filter.siteId = siteId;
    } else {
      filter.siteId = { $in: req.user.managedSiteIds };
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
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { guardId, siteId, weekStartDate, days } = req.body;
    const checkpointIds = [...new Set((Array.isArray(req.body.checkpointIds) ? req.body.checkpointIds : []).map(String))];
    const orgId = req.user.organisationId;

    const guard = await User.findOne({ _id: guardId, organisationId: orgId, role: 'guard', active: true }).select('name fcmToken siteId');
    if (!guard) return res.status(404).json({ error: 'Active guard not found in this organisation.' });

    const site = await Site.findOne({ _id: siteId, organisationId: orgId, active: true });
    if (!site) return res.status(404).json({ error: 'Site not found.' });

    if (req.user.role === 'manager' && !req.user.managedSiteIds.some(id => String(id) === String(siteId))) {
      return res.status(403).json({ error: 'Site is outside your assigned area.' });
    }

    if (checkpointIds.length) {
      const validCount = await PatrolCheckpoint.countDocuments({ _id: { $in: checkpointIds }, organisationId: orgId, siteId, active: true });
      if (validCount !== checkpointIds.length) return res.status(400).json({ error: 'One or more selected checkpoints are not active at this site.' });
    }

    // Check for conflicting overlapping shifts across other sites for this guard in the same week
    const existingOtherSiteRosters = await ShiftRoster.find({
      organisationId: orgId,
      guardId,
      weekStartDate,
      siteId: { $ne: siteId }
    }).populate('siteId', 'name');

    const dayKeys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
    for (const other of existingOtherSiteRosters) {
      for (const d of dayKeys) {
        if (days[d] && other.days?.[d]) {
          if (shiftsOverlap(days[d], other.days[d])) {
            return res.status(409).json({
              error: `Overlapping shift conflict on ${d.toUpperCase()}: Guard is already scheduled at ${other.siteId?.name || 'another site'} (${other.days[d].start} - ${other.days[d].end}).`,
              conflictDay: d,
              conflictingSite: other.siteId?.name,
              conflictingShift: other.days[d]
            });
          }
        }
      }
    }

    const roster = await ShiftRoster.findOneAndUpdate(
      { organisationId: orgId, guardId, siteId, weekStartDate },
      {
        organisationId: orgId,
        guardId,
        siteId,
        checkpointIds,
        publishedBy:    req.user._id,
        weekStartDate,
        days,
        publishedAt:    new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Send FCM push to guard
    if (guard?.fcmToken) {
      const workedDays = Object.entries(days)
        .filter(([, shift]) => shift)
        .map(([key, shift]) => `${key.charAt(0).toUpperCase() + key.slice(1)} ${shift.start}–${shift.end}`)
        .join(', ');

      await fcm.sendPush([guard.fcmToken], {
        title: '📅 Your schedule is ready',
        body:  `Your shifts at ${site.name} for week ${weekStartDate}: ${workedDays || 'None'}.${checkpointIds.length ? ` ${checkpointIds.length} checkpoints.` : ''}`,
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

// ── Edit an existing roster ───────────────────────────────────────────────────
router.patch('/:id',
  authenticate, requireRole('manager','admin','superadmin'),
  asyncHandler(async (req, res) => {
    const roster = await ShiftRoster.findOne({
      _id: req.params.id,
      organisationId: req.user.organisationId,
      ...(req.user.role === 'manager' ? { siteId: { $in: req.user.managedSiteIds } } : {}),
    });
    if (!roster) return res.status(404).json({ error: 'Roster not found or inaccessible.' });

    if (req.body.days) {
      roster.days = req.body.days;
    }
    if (Array.isArray(req.body.checkpointIds)) {
      roster.checkpointIds = req.body.checkpointIds;
    }
    await roster.save();

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
    const roster = await ShiftRoster.findOneAndDelete({
      _id: req.params.id,
      organisationId: req.user.organisationId,
      ...(req.user.role === 'manager' ? { siteId: { $in: req.user.managedSiteIds } } : {}),
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
    filter.siteId = { $in: req.user.managedSiteIds };
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

  const rosters = await ShiftRoster.find({
    organisationId: req.user.organisationId,
    guardId:        req.params.guardId,
    weekStartDate,
  }).populate('siteId', 'name address what3words latitude longitude');

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
      if (req.user.role === 'manager') filter.siteId = { $in: req.user.managedSiteIds };
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
    await RosterTemplate.findOneAndDelete({
      _id: req.params.id, organisationId: req.user.organisationId,
    });
    res.json({ message: 'Template deleted' });
  })
);

module.exports = router;
