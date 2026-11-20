const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();

const { User, Site, Organisation, ShiftSession, CheckCall } = require('./src/models');

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const org = await Organisation.findOne();
  if (!org) throw new Error('No organisation found!');
  const site = await Site.findOne({ name: /Totmonslow/i });
  if (!site) throw new Error('No Totmonslow site found!');

  console.log(`Using Org: ${org.name} (${org._id}), Site: ${site.name} (${site._id})`);

  // Guards map
  const users = await User.find({ organisationId: org._id, role: 'guard' });
  const guardMap = new Map();
  users.forEach(u => guardMap.set(u.name, u));

  // Load extracted shifts
  const extracted = JSON.parse(fs.readFileSync('../scratch/extracted_1018_shifts.json', 'utf8'));
  console.log(`Loaded ${extracted.length} extracted shifts.`);

  // Find existing sessions in DB
  const existingSessions = await ShiftSession.find({ organisationId: org._id }).populate('guardId', 'name');
  const dbSessionKeys = new Set();
  existingSessions.forEach(s => {
    if (!s.guardId) return;
    const dateStr = s.bookedOnAt.toISOString().slice(0, 10);
    const isDay = s.scheduledStart === '07:00' || (s.bookedOnAt.getUTCHours() >= 6 && s.bookedOnAt.getUTCHours() < 18);
    const type = isDay ? 'Day' : 'Night';
    dbSessionKeys.add(`${dateStr}_${s.guardId.name}_${type}`);
  });

  const missingShifts = extracted.filter(s => !dbSessionKeys.has(`${s.shiftDate}_${s.officerName}_${s.shiftType}`));
  console.log(`Found ${missingShifts.length} missing shifts to insert.`);

  const sessionsToInsert = [];
  const callsToInsert = [];

  for (const shift of missingShifts) {
    const guard = guardMap.get(shift.officerName);
    if (!guard) throw new Error(`Unknown guard: ${shift.officerName}`);

    const isDay = shift.shiftType === 'Day';
    const shiftDate = shift.shiftDate; // YYYY-MM-DD
    const nextDateObj = new Date(`${shiftDate}T00:00:00.000Z`);
    nextDateObj.setUTCDate(nextDateObj.getUTCDate() + 1);
    const nextDate = nextDateObj.toISOString().slice(0, 10);

    let scheduledStart = isDay ? '07:00' : '19:00';
    let scheduledEnd = isDay ? '19:00' : '07:00';
    if (isDay && shift.tokens[0] === '-' && shift.tokens[6] !== '-') {
      scheduledStart = '13:00';
    }
    if (!isDay && shift.tokens[0] === '-' && shift.tokens[6] !== '-') {
      scheduledStart = '00:00';
    }

    function makeDateTime(timeStr, slotIdx) {
      let h = parseInt(timeStr.slice(0, 2), 10);
      let m = parseInt(timeStr.slice(2), 10);
      if (m >= 60) m = 56;
      let dStr = shiftDate;
      if (!isDay && (slotIdx >= 5 || h < 12)) {
        dStr = nextDate;
      }
      return new Date(`${dStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
    }

    let firstCallTime = null;
    let lastCallTime = null;
    let firstIdx = -1;
    let lastIdx = -1;
    shift.tokens.forEach((t, idx) => {
      if (t !== '-') {
        if (!firstCallTime) {
          firstCallTime = t;
          firstIdx = idx;
        }
        lastCallTime = t;
        lastIdx = idx;
      }
    });

    const bookedOnAt = firstCallTime ? makeDateTime(firstCallTime, firstIdx) : new Date(`${shiftDate}T${isDay ? '06:55' : '18:55'}:00.000Z`);
    const bookedOffAt = lastCallTime ? makeDateTime(lastCallTime, lastIdx) : new Date(`${isDay ? shiftDate : nextDate}T${isDay ? '19:05' : '07:05'}:00.000Z`);

    const sessionId = new mongoose.Types.ObjectId();
    const activeTokens = shift.tokens.filter(t => t !== '-');

    sessionsToInsert.push({
      _id: sessionId,
      organisationId: org._id,
      guardId: guard._id,
      siteId: site._id,
      bookedOnAt,
      bookedOffAt,
      scheduledStart,
      scheduledEnd,
      scheduledEndAt: isDay ? new Date(`${shiftDate}T19:00:00.000Z`) : new Date(`${nextDate}T07:00:00.000Z`),
      punctuality: 'on_time',
      checkCallCount: activeTokens.length,
      missedCheckCallCount: 0,
      patrolCount: 0,
      autoEnded: false,
      createdAt: bookedOnAt,
      updatedAt: bookedOffAt,
    });

    shift.tokens.forEach((timeStr, slotIdx) => {
      if (timeStr === '-') return;
      const actualDate = makeDateTime(timeStr, slotIdx);

      let schedHour = isDay ? (7 + slotIdx) : ((19 + slotIdx) % 24);
      let schedDate = shiftDate;
      if (!isDay && slotIdx >= 5) schedDate = nextDate;
      const scheduledFor = new Date(`${schedDate}T${String(schedHour).padStart(2, '0')}:00:00.000Z`);

      callsToInsert.push({
        _id: new mongoose.Types.ObjectId(),
        organisationId: org._id,
        sessionId,
        guardId: guard._id,
        siteId: site._id,
        firedAt: actualDate,
        scheduledFor,
        expiresAt: new Date(actualDate.getTime() + 15 * 60 * 1000),
        respondedAt: actualDate,
        response: 'yes',
        isManualLog: true,
        isRandom: false,
        createdAt: actualDate,
        updatedAt: actualDate,
      });
    });
  }

  console.log(`Inserting ${sessionsToInsert.length} ShiftSessions...`);
  await ShiftSession.insertMany(sessionsToInsert);
  console.log(`Inserting ${callsToInsert.length} CheckCalls...`);
  await CheckCall.insertMany(callsToInsert);

  console.log('SUCCESSFULLY INSERTED ALL MISSING SESSIONS AND CHECK CALLS!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
