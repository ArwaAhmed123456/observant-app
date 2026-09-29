/**
 * Reports routes
 *
 * GET /api/reports/shift-calls  — combined check call + patrol report (JSON)
 * GET /api/reports/shift-calls/csv — same report as CSV download
 * GET /api/reports/summary      — KPI summary (counts, rates)
 */
const router = require('express').Router();
const { stringify } = require('csv-stringify');
const { CheckCall, PatrolSession, ShiftSession, User, Site } = require('../models');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// ── Build query filter from request ───────────────────────────────────────────
function buildFilter(req) {
  const { guardId, siteId, from, to } = req.query;
  const orgId = req.user.organisationId;
  const filter = { organisationId: orgId };

  // Managers see all their sites; narrow by param
  if (req.user.role === 'manager') {
    const allowedSites = req.user.managedSiteIds.map(String);
    if (siteId && !allowedSites.includes(siteId)) filter.siteId = null;
    else filter.siteId = siteId || { $in: req.user.managedSiteIds };
  }
  if (guardId) filter.guardId = guardId;
  if (from || to) {
    filter.firedAt = {};
    if (from) filter.firedAt.$gte = new Date(from);
    if (to)   filter.firedAt.$lte = new Date(to);
  }
  return filter;
}

// ── JSON report ───────────────────────────────────────────────────────────────
router.get('/shift-calls', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const { type = 'combined' } = req.query;
    const ccFilter = buildFilter(req);
    // Patrol uses startedAt, not firedAt
    const patrolFilter = { ...buildFilter(req) };
    if (patrolFilter.firedAt) {
      patrolFilter.startedAt = patrolFilter.firedAt;
      delete patrolFilter.firedAt;
    }

    const [checkCalls, patrols, sessions] = await Promise.all([
      type !== 'patrols'
        ? CheckCall.find(ccFilter)
            .sort({ firedAt: -1 })
            .populate('guardId', 'name badgeNumber')
            .populate('siteId',  'name')
        : [],
      type !== 'check_calls'
        ? PatrolSession.find(patrolFilter)
            .sort({ startedAt: -1 })
            .populate('guardId', 'name badgeNumber')
            .populate('siteId',  'name')
            .select('-captures')
        : [],
      ShiftSession.find({ organisationId: req.user.organisationId, ...(req.user.role === 'manager' ? { siteId: { $in: req.user.managedSiteIds } } : {}) })
        .select('_id bookedOnAt bookedOffAt'),
    ]);

    // Attach session info to check calls
    const sessionMap = Object.fromEntries(sessions.map(s => [s._id.toString(), s]));

    const ccRows = checkCalls.map(cc => ({
      type:             'check_call',
      id:               cc._id,
      date:             cc.firedAt,
      guardName:        cc.guardId?.name,
      badgeNumber:      cc.guardId?.badgeNumber,
      site:             cc.siteId?.name,
      shiftStart:       sessionMap[cc.sessionId?.toString()]?.bookedOnAt,
      shiftEnd:         sessionMap[cc.sessionId?.toString()]?.bookedOffAt,
      checkCallTime:    cc.firedAt,
      response:         cc.response,
      respondedAt:      cc.respondedAt,
      note:             cc.note,
      isRandom:         cc.isRandom,
      managerAlerted:   cc.managerAlerted,
    }));

    const patrolRows = patrols.map(p => ({
      type:               'patrol',
      id:                 p._id,
      date:               p.startedAt,
      guardName:          p.guardId?.name,
      badgeNumber:        p.guardId?.badgeNumber,
      site:               p.siteId?.name,
      patrolStart:        p.startedAt,
      patrolEnd:          p.finishedAt,
      status:             p.status,
      capturedCount:      p.capturedCheckpointIds?.length || 0,
      missingCount:       p.missingCheckpointIds?.length || 0,
      triggeredByAntiIdle:p.triggeredByAntiIdle,
    }));

    const rows = [...ccRows, ...patrolRows].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ rows, total: rows.length });
  })
);

// ── CSV export ────────────────────────────────────────────────────────────────
router.get('/shift-calls/csv', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const ccFilter = buildFilter(req);
    const patrolFilter = { ...buildFilter(req) };
    if (patrolFilter.firedAt) {
      patrolFilter.startedAt = patrolFilter.firedAt;
      delete patrolFilter.firedAt;
    }

    const [checkCalls, patrols] = await Promise.all([
      CheckCall.find(ccFilter)
        .sort({ firedAt: -1 })
        .populate('guardId', 'name badgeNumber')
        .populate('siteId',  'name'),
      PatrolSession.find(patrolFilter)
        .sort({ startedAt: -1 })
        .populate('guardId', 'name badgeNumber')
        .populate('siteId',  'name')
        .select('-captures'),
    ]);

    const headers = [
      'Type','Date','Guard Name','Badge','Site',
      'Check Call Time','Response','Responded At','Note',
      'Patrol Start','Patrol End','Patrol Status','Checkpoints Captured','Missing Checkpoints',
    ];

    const ccRows = checkCalls.map(cc => [
      'Check Call',
      cc.firedAt?.toISOString().slice(0,10),
      cc.guardId?.name, cc.guardId?.badgeNumber, cc.siteId?.name,
      cc.firedAt?.toLocaleTimeString('en-GB'),
      cc.response || 'pending',
      cc.respondedAt?.toLocaleTimeString('en-GB') || '',
      cc.note || '',
      '', '', '', '', '',
    ]);

    const patrolRows = patrols.map(p => [
      'Patrol',
      p.startedAt?.toISOString().slice(0,10),
      p.guardId?.name, p.guardId?.badgeNumber, p.siteId?.name,
      '', '', '', '',
      p.startedAt?.toLocaleTimeString('en-GB'),
      p.finishedAt?.toLocaleTimeString('en-GB') || 'ongoing',
      p.status,
      p.capturedCheckpointIds?.length || 0,
      p.missingCheckpointIds?.length || 0,
    ]);

    const allRows = [...ccRows, ...patrolRows];

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="observant-report-${Date.now()}.csv"`);

    stringify([headers, ...allRows], { quoted: true }).pipe(res);
  })
);

// ── Summary KPIs ──────────────────────────────────────────────────────────────
router.get('/summary', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const { from, to, siteId } = req.query;
    const orgId = req.user.organisationId;

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from);
    if (to)   dateFilter.$lte = new Date(to);

    const siteFilter = {};
    if (siteId) {
      if (req.user.role === 'manager' && !req.user.managedSiteIds.some(id => String(id) === String(siteId))) return res.status(403).json({ error: 'Site is outside your assigned sites.' });
      siteFilter.siteId = siteId;
    } else if (req.user.role === 'manager') {
      siteFilter.siteId = { $in: req.user.managedSiteIds };
    }

    const ccFilter = { organisationId: orgId, ...siteFilter };
    if (Object.keys(dateFilter).length) ccFilter.firedAt = dateFilter;

    const patrolFilter = { organisationId: orgId, ...siteFilter };
    if (Object.keys(dateFilter).length) patrolFilter.startedAt = dateFilter;

    const [
      totalCC, completedCC, missedCC, issuedCC,
      totalPatrols, completePatrols, incompletePatrols,
      activeSessions,
    ] = await Promise.all([
      CheckCall.countDocuments(ccFilter),
      CheckCall.countDocuments({ ...ccFilter, response: 'yes' }),
      CheckCall.countDocuments({ ...ccFilter, response: 'missed' }),
      CheckCall.countDocuments({ ...ccFilter, response: 'no' }),
      PatrolSession.countDocuments(patrolFilter),
      PatrolSession.countDocuments({ ...patrolFilter, status: 'complete' }),
      PatrolSession.countDocuments({ ...patrolFilter, status: 'incomplete' }),
      ShiftSession.countDocuments({
        organisationId: orgId, ...siteFilter, bookedOffAt: null
      }),
    ]);

    const checkCallRate = totalCC > 0
      ? Math.round((completedCC / totalCC) * 100) + '%'
      : 'N/A';

    res.json({
      summary: {
        activeSessions,
        checkCalls:    { total: totalCC, completed: completedCC, missed: missedCC, issues: issuedCC, rate: checkCallRate },
        patrols:       { total: totalPatrols, complete: completePatrols, incomplete: incompletePatrols },
      },
    });
  })
);

module.exports = router;
