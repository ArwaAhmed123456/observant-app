const mongoose = require('mongoose');
require('dotenv').config({ path: __dirname + '/.env' });
const { ShiftSession, CheckCall, Organisation, Site, User } = require('./src/models');

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
  const firstSlot = new Date(`${values.shiftDate}T${values.shiftType === 'Day' ? '07' : '19'}:00:00.000Z`);
  return {
    siteName: values.siteName,
    officerName: values.officerName,
    shiftDate: values.shiftDate,
    shiftType: values.shiftType,
    shiftStart: values.shiftStart,
    shiftEnd: values.shiftEnd,
    hourlyChecks: Array.from({ length: 13 }, (_, index) => ({
      slot: `${String(values.shiftType === 'Day' ? 7 + index : (19 + index) % 24).padStart(2, '0')}00`,
      checks: []
    }))
  };
}

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);

  const start = new Date('2026-11-09T00:00:00.000Z');
  const end = new Date('2026-11-16T00:00:00.000Z');

  const sessions = await ShiftSession.find({
    bookedOnAt: { $gte: start, $lt: end }
  }).populate('guardId', 'name').populate('siteId', 'name');

  const sessionIds = sessions.map(s => s._id);
  const checkCalls = await CheckCall.find({
    $or: [{ sessionId: { $in: sessionIds } }, { firedAt: { $gte: start, $lt: new Date(end.getTime() + 24 * HOUR_MS) } }]
  }).populate('guardId', 'name').sort({ respondedAt: 1, firedAt: 1 });

  const rowsByKey = new Map();
  const sessionToRow = new Map();
  const reportSessionIds = new Set(sessions.map(s => String(s._id)));

  const ensureRow = values => {
    const key = [values.siteId, values.officerId, values.shiftDate, values.shiftType].join(':');
    if (!rowsByKey.has(key)) rowsByKey.set(key, createShiftRow(values));
    return rowsByKey.get(key);
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
    if (call.sessionId && reportSessionIds.has(String(call.sessionId)) && !row) return;
    if (!row) return; // ignore orphan calls outside sessions
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

  console.log(`\nGenerated ${sortedRows.length} rows for 2026-11-09 to 2026-11-15:`);
  sortedRows.forEach(r => {
    const times = r.hourlyChecks.map(h => h.checks.join('/') || '-');
    console.log(`${r.shiftDate} | ${r.shiftType.padEnd(5)} | ${r.officerName.padEnd(16)} | ${times.join(' ')}`);
  });

  await mongoose.disconnect();
}

test().catch(console.error);
