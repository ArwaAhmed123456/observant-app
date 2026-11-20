const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });
const { ShiftSession, CheckCall, User, Site } = require('./src/models');

const HOUR_MS = 60 * 60 * 1000;
function toDayKey(date) {
  const d = new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const DAY_OFFICER_ORDER = ['Abdullah Malik', 'Rehman Saleem', 'Waqar Javaid', 'Asad Iqbal', 'Ukasha Ayaz', 'Shah Fahad', 'Jamal Faisal Sharif'];
const NIGHT_OFFICER_ORDER = ['Waqar Javaid', 'Asad Iqbal', 'Ukasha Ayaz', 'Abdullah Malik', 'Rehman Saleem', 'Shah Fahad', 'Jamal Faisal Sharif'];

function getOfficerRank(shiftType, officerName) {
  const list = shiftType === 'Day' ? DAY_OFFICER_ORDER : NIGHT_OFFICER_ORDER;
  const idx = list.indexOf(officerName);
  return idx === -1 ? 999 : idx;
}

function shiftDetails(session) {
  const isNight = session.scheduledStart === '19:00' || (!session.scheduledStart && session.bookedOnAt.getUTCHours() >= 18);
  const shiftType = isNight ? 'Night' : 'Day';
  const shiftDate = new Date(session.bookedOnAt);
  if (shiftType === 'Night' && shiftDate.getUTCHours() < 7) {
    shiftDate.setUTCDate(shiftDate.getUTCDate() - 1);
  }
  return { shiftType, shiftDate: toDayKey(shiftDate) };
}

function createShiftRow(values) {
  return {
    siteName: values.siteName,
    officerName: values.officerName,
    shiftDate: values.shiftDate,
    shiftType: values.shiftType,
    shiftStart: values.shiftStart,
    shiftEnd: values.shiftEnd,
    hourlyChecks: Array.from({ length: 13 }, (_, index) => ({ checks: [] }))
  };
}

async function runTest(startDateStr, endDateStr) {
  const start = new Date(`${startDateStr}T00:00:00.000Z`);
  const end = new Date(`${endDateStr}T23:59:59.999Z`);
  const endExclusive = new Date(new Date(`${endDateStr}T00:00:00.000Z`).getTime() + 24 * HOUR_MS);

  const sessions = await ShiftSession.find({
    bookedOnAt: { $gte: start, $lt: endExclusive }
  }).sort({ bookedOnAt: 1 }).populate('guardId', 'name badgeNumber').populate('siteId', 'name');

  const sessionIds = sessions.map(s => s._id);
  const checkCalls = await CheckCall.find({
    firedAt: { $gte: start, $lt: new Date(endExclusive.getTime() + 24 * HOUR_MS) },
    $or: [{ sessionId: { $in: sessionIds } }, { sessionId: null }]
  }).sort({ respondedAt: 1, firedAt: 1 }).populate('guardId', 'name badgeNumber').populate('siteId', 'name');

  const rowsByKey = new Map();
  const sessionToRow = new Map();

  const ensureRow = values => {
    const key = [values.siteId, values.officerId, values.shiftDate, values.shiftType].join(':');
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
      officerId: session.guardId._id, officerName: session.guardId.name,
      ...details, shiftStart: session.bookedOnAt, shiftEnd: session.bookedOffAt
    });
    if (row) sessionToRow.set(String(session._id), row);
  });

  checkCalls.forEach(call => {
    if (!call.guardId || !call.siteId) return;
    let row = call.sessionId ? sessionToRow.get(String(call.sessionId)) : null;
    if (!row) {
      const callTime = call.respondedAt ? new Date(call.respondedAt) : new Date(call.firedAt);
      const matchingSession = sessions.find(s => {
        if (String(s.guardId._id) !== String(call.guardId._id)) return false;
        const sStart = new Date(s.bookedOnAt).getTime();
        const sEnd = s.bookedOffAt ? new Date(s.bookedOffAt).getTime() : (s.scheduledEndAt ? new Date(s.scheduledEndAt).getTime() : sStart + 13 * HOUR_MS);
        const cTime = callTime.getTime();
        return cTime >= (sStart - 45 * 60 * 1000) && cTime <= (sEnd + 45 * 60 * 1000);
      });
      if (matchingSession) {
        row = sessionToRow.get(String(matchingSession._id));
      }
    }
    if (!row) return;

    const checkedAt = call.respondedAt ? new Date(call.respondedAt) : call.firedAt;
    const firstSlot = new Date(`${row.shiftDate}T${row.shiftType === 'Day' ? '07' : '19'}:00:00.000Z`);
    const refTime = new Date(checkedAt).getTime();
    const index = Math.round((refTime - firstSlot.getTime()) / HOUR_MS);
    if (index >= 0 && index <= 12) {
      const hhmm = `${String(checkedAt.getUTCHours()).padStart(2, '0')}${String(checkedAt.getUTCMinutes()).padStart(2, '0')}`;
      row.hourlyChecks[index].checks.push(hhmm);
    }
  });

  const sortedRows = [...rowsByKey.values()].sort((a, b) => {
    if (a.shiftDate !== b.shiftDate) return a.shiftDate.localeCompare(b.shiftDate);
    if (a.shiftType !== b.shiftType) return a.shiftType === 'Day' ? -1 : 1;
    const rankA = getOfficerRank(a.shiftType, a.officerName);
    const rankB = getOfficerRank(b.shiftType, b.officerName);
    if (rankA !== rankB) return rankA - rankB;
    return a.officerName.localeCompare(b.officerName);
  });

  console.log(`\n=== REPORT FOR ${startDateStr} to ${endDateStr} (${sortedRows.length} rows) ===`);
  sortedRows.forEach(r => {
    const times = r.hourlyChecks.map(h => h.checks.join('/') || '-');
    console.log(`${r.shiftDate} | ${r.shiftType.padEnd(5)} | ${r.officerName.padEnd(16)} | ${times.join(' ')}`);
  });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  await runTest('2026-11-09', '2026-11-15');
  await runTest('2026-11-16', '2026-11-22');
  await mongoose.disconnect();
}

main().catch(console.error);
