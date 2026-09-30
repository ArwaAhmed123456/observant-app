/**
 * Reports routes
 *
 * GET /api/reports/shift-calls  — combined check call + patrol report (JSON)
 * GET /api/reports/shift-calls/csv — same report as CSV download
 * GET /api/reports/summary      — KPI summary (counts, rates)
 */
const router = require('express').Router();
const { stringify } = require('csv-stringify');
const { CheckCall, PatrolSession, ShiftSession, User, Site, Organisation } = require('../models');
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

const HOUR_MS = 60 * 60 * 1000;
const toDayKey = date => date.toISOString().slice(0, 10);
const hourLabel = date => `${String(date.getUTCHours()).padStart(2, '0')}00`;
const validObjectId = value => require('mongoose').isValidObjectId(value);

function parseDateRange(startDate, endDate) {
  if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return { error: 'startDate and endDate are required in YYYY-MM-DD format.' };
  }
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const endInclusive = new Date(`${endDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(endInclusive.getTime()) || toDayKey(start) !== startDate || toDayKey(endInclusive) !== endDate) {
    return { error: 'Provide valid calendar dates.' };
  }
  if (start > endInclusive) return { error: 'startDate must be on or before endDate.' };
  if (endInclusive.getTime() - start.getTime() > 366 * 24 * HOUR_MS) return { error: 'The report range cannot exceed 367 calendar days.' };
  return { start, endExclusive: new Date(endInclusive.getTime() + 24 * HOUR_MS) };
}

function shiftDetails(session) {
  const actualStart = new Date(session.bookedOnAt);
  const scheduledStart = session.scheduledStart && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(session.scheduledStart)
    ? Number(session.scheduledStart.slice(0, 2))
    : actualStart.getUTCHours();
  const shiftType = scheduledStart >= 7 && scheduledStart < 19 ? 'Day' : 'Night';
  const shiftDate = new Date(Date.UTC(actualStart.getUTCFullYear(), actualStart.getUTCMonth(), actualStart.getUTCDate()));
  if (shiftType === 'Night' && scheduledStart < 7) shiftDate.setUTCDate(shiftDate.getUTCDate() - 1);
  return { shiftDate: toDayKey(shiftDate), shiftType };
}

function createShiftRow({ siteId, siteName, officerId, officerName, badgeNumber, shiftDate, shiftType, shiftStart, shiftEnd }) {
  const firstHour = shiftType === 'Day' ? 7 : 19;
  const start = new Date(`${shiftDate}T${String(firstHour).padStart(2, '0')}:00:00.000Z`);
  return {
    siteId: String(siteId), siteName: siteName || 'Unknown site',
    officerId: String(officerId), officerName: officerName || 'Unknown officer', badgeNumber: badgeNumber || null,
    shiftDate, shiftType, shiftStart: shiftStart || null, shiftEnd: shiftEnd || null,
    hourlyChecks: Array.from({ length: 13 }, (_, index) => ({
      hour: hourLabel(new Date(start.getTime() + index * HOUR_MS)),
      scheduledAt: new Date(start.getTime() + index * HOUR_MS).toISOString(),
      checks: [], isLate: false,
    })),
  };
}

// ── Check Call Log matrix ─────────────────────────────────────────────────────
router.get('/check-call-log', authenticate, requireRole('manager', 'admin'),
  asyncHandler(async (req, res) => {
    const { startDate, endDate, siteId, officerId } = req.query;
    const parsed = parseDateRange(startDate, endDate);
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const requestedShiftType = req.query.shiftType;
    if (requestedShiftType && !['day', 'night'].includes(String(requestedShiftType).toLowerCase())) {
      return res.status(400).json({ error: 'shiftType must be Day or Night.' });
    }
    for (const [label, value] of [['siteId', siteId], ['officerId', officerId]]) {
      if (value && !validObjectId(value)) return res.status(400).json({ error: `${label} must be a valid ID.` });
    }

    const organisationId = req.user.organisationId;
    const managerSiteIds = req.user.role === 'manager' ? req.user.managedSiteIds.map(String) : null;
    if (siteId && managerSiteIds && !managerSiteIds.includes(String(siteId))) {
      return res.status(403).json({ error: 'Site is outside your assigned sites.' });
    }
    const siteFilter = req.user.role === 'manager'
      ? { $in: siteId ? [siteId] : req.user.managedSiteIds }
      : siteId || { $exists: true };
    const shiftQuery = {
      organisationId,
      siteId: siteFilter,
      bookedOnAt: { $gte: parsed.start, $lt: parsed.endExclusive },
      ...(officerId ? { guardId: officerId } : {}),
    };

    const [organisation, sessions] = await Promise.all([
      Organisation.findById(organisationId).select('name slug logoUrl settings.checkCallWindowMinutes'),
      ShiftSession.find(shiftQuery)
        .sort({ bookedOnAt: 1 })
        .populate('guardId', 'name badgeNumber')
        .populate('siteId', 'name'),
    ]);

    const sessionIds = sessions.map(session => session._id);
    const checkCallQuery = {
      organisationId,
      siteId: siteFilter,
      firedAt: { $gte: parsed.start, $lt: new Date(parsed.endExclusive.getTime() + 24 * HOUR_MS) },
      ...(officerId ? { guardId: officerId } : {}),
      ...(sessionIds.length ? { $or: [{ sessionId: { $in: sessionIds } }, { sessionId: null }] } : { sessionId: null }),
    };
    const checkCalls = await CheckCall.find(checkCallQuery)
      .sort({ respondedAt: 1, firedAt: 1 })
      .populate('guardId', 'name badgeNumber')
      .populate('siteId', 'name');

    const rowsByKey = new Map();
    const sessionToRow = new Map();
    const reportSessionIds = new Set(sessions.map(session => String(session._id)));
    const ensureRow = values => {
      const type = values.shiftType;
      if (requestedShiftType && type.toLowerCase() !== String(requestedShiftType).toLowerCase()) return null;
      const key = [values.siteId, values.officerId, values.shiftDate, type].join(':');
      if (!rowsByKey.has(key)) rowsByKey.set(key, createShiftRow(values));
      const row = rowsByKey.get(key);
      if (values.shiftStart && (!row.shiftStart || values.shiftStart < row.shiftStart)) row.shiftStart = values.shiftStart;
      if (values.shiftEnd && (!row.shiftEnd || values.shiftEnd > row.shiftEnd)) row.shiftEnd = values.shiftEnd;
      return row;
    };

    sessions.forEach(session => {
      if (!session.guardId || !session.siteId) return;
      const details = shiftDetails(session);
      const row = ensureRow({
        siteId: session.siteId._id, siteName: session.siteId.name,
        officerId: session.guardId._id, officerName: session.guardId.name, badgeNumber: session.guardId.badgeNumber,
        ...details, shiftStart: session.bookedOnAt, shiftEnd: session.bookedOffAt,
      });
      if (row) sessionToRow.set(String(session._id), row);
    });

    const configuredWindow = Number(organisation?.settings?.checkCallWindowMinutes ?? 10);
    const windowMinutes = Number.isFinite(configuredWindow) ? Math.max(0, configuredWindow) : 10;
    checkCalls.forEach(call => {
      if (!call.guardId || !call.siteId) return;
      let row = call.sessionId ? sessionToRow.get(String(call.sessionId)) : null;
      if (call.sessionId && reportSessionIds.has(String(call.sessionId)) && !row) return;
      if (!row) {
        const activityTime = call.respondedAt || call.firedAt;
        const hour = activityTime.getUTCHours();
        const shiftType = hour >= 7 && hour < 19 ? 'Day' : 'Night';
        const shiftDate = new Date(Date.UTC(activityTime.getUTCFullYear(), activityTime.getUTCMonth(), activityTime.getUTCDate()));
        if (shiftType === 'Night' && hour < 7) shiftDate.setUTCDate(shiftDate.getUTCDate() - 1);
        row = ensureRow({
          siteId: call.siteId._id, siteName: call.siteId.name,
          officerId: call.guardId._id, officerName: call.guardId.name, badgeNumber: call.guardId.badgeNumber,
          shiftDate: toDayKey(shiftDate), shiftType,
        });
      }
      if (!row) return;
      const checkedAt = call.respondedAt ? new Date(call.respondedAt) : null;
      const slotReference = call.scheduledFor || checkedAt || call.firedAt;
      const target = new Date(slotReference);
      target.setUTCMinutes(0, 0, 0);
      const firstSlot = new Date(`${row.shiftDate}T${row.shiftType === 'Day' ? '07' : '19'}:00:00.000Z`);
      const index = Math.floor((target.getTime() - firstSlot.getTime()) / HOUR_MS);
      if (index < 0 || index > 12) return;
      const scheduledAt = new Date(firstSlot.getTime() + index * HOUR_MS);
      const dueAt = call.scheduledFor ? new Date(call.scheduledFor) : scheduledAt;
      const isLate = Boolean(checkedAt && checkedAt.getTime() > dueAt.getTime() + windowMinutes * 60 * 1000);
      const entry = {
        id: String(call._id), timestamp: checkedAt ? checkedAt.toISOString() : null,
        time: checkedAt ? `${String(checkedAt.getUTCHours()).padStart(2, '0')}${String(checkedAt.getUTCMinutes()).padStart(2, '0')}` : null,
        response: call.response || 'pending', scheduledAt: scheduledAt.toISOString(), isLate,
        isRandom: Boolean(call.isRandom), note: call.note || null,
      };
      row.hourlyChecks[index].checks.push(entry);
      row.hourlyChecks[index].isLate = row.hourlyChecks[index].isLate || isLate;
    });

    const rows = [...rowsByKey.values()].sort((a, b) =>
      a.siteName.localeCompare(b.siteName) || a.officerName.localeCompare(b.officerName) || a.shiftDate.localeCompare(b.shiftDate) || a.shiftType.localeCompare(b.shiftType)
    );
    res.json({
      company: { name: organisation?.name || 'Observant Security', slug: organisation?.slug || null, logoUrl: organisation?.logoUrl || null },
      dateRange: { startDate, endDate, timezone: 'UTC' },
      filters: { siteId: siteId || null, officerId: officerId || null, shiftType: requestedShiftType ? (String(requestedShiftType).toLowerCase() === 'day' ? 'Day' : 'Night') : null },
      schedule: { checkCallWindowMinutes: windowMinutes, dayHours: Array.from({ length: 13 }, (_, index) => `${String(7 + index).padStart(2, '0')}00`), nightHours: Array.from({ length: 13 }, (_, index) => `${String((19 + index) % 24).padStart(2, '0')}00`) },
      rows,
      total: rows.length,
    });
  })
);

// ── JSON report ───────────────────────────────────────────────────────────────
router.get('/shift-calls', authenticate, requireRole('manager','admin'),
  asyncHandler(async (req, res) => {
    const { type = 'combined' } = req.query;
    const includeImages = req.query.includeImages === 'true';
    const ccFilter = buildFilter(req);
    // Patrol uses startedAt, not firedAt
    const patrolFilter = { ...buildFilter(req) };
    if (patrolFilter.firedAt) {
      patrolFilter.startedAt = patrolFilter.firedAt;
      delete patrolFilter.firedAt;
    }

    const patrolQuery = type !== 'check_calls'
      ? PatrolSession.find(patrolFilter)
          .sort({ startedAt: -1 })
          .populate('guardId', 'name badgeNumber')
          .populate('siteId',  'name')
      : null;
    if (patrolQuery && includeImages) patrolQuery.populate('captures.checkpointId', 'name order');
    else if (patrolQuery) patrolQuery.select('-captures');

    const [checkCalls, patrols, sessions] = await Promise.all([
      type !== 'patrols'
        ? CheckCall.find(ccFilter)
            .sort({ firedAt: -1 })
            .populate('guardId', 'name badgeNumber')
            .populate('siteId',  'name')
        : [],
      patrolQuery || [],
      ShiftSession.find({ organisationId: req.user.organisationId, ...(req.user.role === 'manager' ? { siteId: { $in: req.user.managedSiteIds } } : {}) })
        .select('_id bookedOnAt bookedOffAt'),
    ]);

    // Attach session info to check calls
    const sessionMap = Object.fromEntries(sessions.map(s => [s._id.toString(), s]));

    const ccRows = checkCalls.map(cc => ({
      type:             'check_call',
      id:               cc._id,
      guardId:          cc.guardId?._id,
      siteId:           cc.siteId?._id,
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
      gps:              cc.location?.latitude != null && cc.location?.longitude != null ? `${cc.location.latitude.toFixed(5)}, ${cc.location.longitude.toFixed(5)}` : null,
      checkpointStatus: cc.response || 'Pending',
      images:           includeImages && cc.photoUrl ? [{ url: cc.photoUrl, checkpointName: 'Check call evidence', capturedAt: cc.respondedAt || cc.firedAt }] : [],
    }));

    const patrolRows = patrols.map(p => ({
      type:               'patrol',
      id:                 p._id,
      guardId:            p.guardId?._id,
      siteId:             p.siteId?._id,
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
      gps: (p.captures || []).filter(capture => capture.latitude != null && capture.longitude != null).map(capture => `${capture.latitude.toFixed(5)}, ${capture.longitude.toFixed(5)}`).join(' · ') || null,
      checkpointStatus:   `${p.capturedCheckpointIds?.length || 0} captured · ${p.missingCheckpointIds?.length || 0} missing`,
      note:               p.managerNote || null,
      images: includeImages ? (p.captures || []).filter(capture => capture.photoUrl).map(capture => ({
        id: capture._id,
        url: capture.photoUrl,
        checkpointName: capture.checkpointId?.name || 'Checkpoint',
        capturedAt: capture.capturedAt,
        latitude: capture.latitude,
        longitude: capture.longitude,
      })) : [],
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
