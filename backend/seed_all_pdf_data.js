const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { User, Site, Organisation, ShiftSession, CheckCall } = require('./src/models');

const SHIFTS_PATH = path.join('C:', 'Users', 'uk354', '.gemini', 'antigravity', 'brain', 'c697be47-6b6e-4152-a27b-fe85d0937974', 'scratch', 'all_shifts.json');

async function main() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  const org = await Organisation.findOne();
  if (!org) throw new Error('No organisation found!');
  const site = await Site.findOne({ name: /Totmonslow/i });
  if (!site) throw new Error('No Totmonslow site found!');

  console.log(`Using Org: ${org.name} (${org._id}), Site: ${site.name} (${site._id})`);

  // Ensure all guards exist
  const GUARD_DEFINITIONS = [
    { name: 'Abdullah Malik', email: 'mabdullah956@gmail.com' },
    { name: 'Asad Iqbal', email: 'asad50507@gmail.com' },
    { name: 'Rehman Saleem', email: 'ipao1992@gmail.com' },
    { name: 'Ukasha Ayaz', email: 'ukashaayaz1877@gmail.com' },
    { name: 'Waqar Javaid', email: 'waqalkhan5249775@gmail.com' },
    { name: 'Shah Fahad', email: 'shahfahad@observantsecurity.co.uk' },
    { name: 'Jamal Faisal Sharif', email: 'faisalsharif@observantsecurity.co.uk' },
  ];

  const defaultPasswordHash = await bcrypt.hash('Guard123!', 10);
  const guardMap = new Map();

  for (const def of GUARD_DEFINITIONS) {
    let user = await User.findOne({ name: def.name, organisationId: org._id });
    if (!user) {
      user = await User.findOne({ email: def.email, organisationId: org._id });
    }
    if (!user) {
      console.log(`Creating guard user: ${def.name} (${def.email})`);
      user = new User({
        organisationId: org._id,
        name: def.name,
        email: def.email,
        password: defaultPasswordHash,
        role: 'guard',
        siteId: site._id,
        assignedSiteIds: [site._id],
        active: true,
      });
      await user.save();
    }
    guardMap.set(def.name, user);
  }

  console.log(`All ${guardMap.size} guards verified in database.`);

  // Load shifts JSON
  const rawData = fs.readFileSync(SHIFTS_PATH, 'utf-8');
  const shiftsData = JSON.parse(rawData);
  console.log(`Loaded ${shiftsData.length} shifts to insert.`);

  const sessionsToInsert = [];
  const sessionCheckCallsMap = [];

  for (const shift of shiftsData) {
    const guard = guardMap.get(shift.officerName);
    if (!guard) throw new Error(`Unknown guard: ${shift.officerName}`);

    const isDay = shift.shiftType === 'Day';
    const shiftDate = shift.shiftDate; // YYYY-MM-DD
    const nextDateObj = new Date(`${shiftDate}T00:00:00.000Z`);
    nextDateObj.setUTCDate(nextDateObj.getUTCDate() + 1);
    const nextDate = nextDateObj.toISOString().slice(0, 10);

    // Determine scheduledStart and scheduledEnd
    let scheduledStart = isDay ? '07:00' : '19:00';
    let scheduledEnd = isDay ? '19:00' : '07:00';
    if (isDay && shift.tokens[0] === '-' && shift.tokens[6] !== '-') {
      scheduledStart = '13:00';
    }

    // Determine actual start & end from non-empty tokens
    let firstCallTime = null;
    let lastCallTime = null;
    shift.tokens.forEach(t => {
      if (t !== '-') {
        if (!firstCallTime) firstCallTime = t;
        lastCallTime = t;
      }
    });

    function makeDateTime(timeStr, slotIdx) {
      let h = parseInt(timeStr.slice(0, 2), 10);
      let m = parseInt(timeStr.slice(2), 10);
      if (m >= 60) m = 56; // sanitize typo if any
      let dStr = shiftDate;
      if (!isDay && (slotIdx >= 5 || h < 12)) {
        dStr = nextDate;
      }
      const dt = new Date(`${dStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`);
      if (isNaN(dt.getTime())) throw new Error(`Invalid Date produced from ${timeStr} at slot ${slotIdx} date ${shiftDate}`);
      return dt;
    }

    let bookedOnAt = isDay
      ? new Date(`${shiftDate}T06:55:00.000Z`)
      : new Date(`${shiftDate}T18:55:00.000Z`);
    if (firstCallTime) {
      const idx = shift.tokens.indexOf(firstCallTime);
      bookedOnAt = makeDateTime(firstCallTime, idx);
    }

    let bookedOffAt = isDay
      ? new Date(`${shiftDate}T19:05:00.000Z`)
      : new Date(`${nextDate}T07:05:00.000Z`);
    if (lastCallTime) {
      const idx = shift.tokens.lastIndexOf(lastCallTime);
      bookedOffAt = makeDateTime(lastCallTime, idx);
    }

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

    // Check calls for this shift
    shift.tokens.forEach((timeStr, slotIdx) => {
      if (timeStr === '-') return;
      const actualDate = makeDateTime(timeStr, slotIdx);

      let schedHour = isDay ? (7 + slotIdx) : ((19 + slotIdx) % 24);
      let schedDate = shiftDate;
      if (!isDay && slotIdx >= 5) schedDate = nextDate;
      const scheduledFor = new Date(`${schedDate}T${String(schedHour).padStart(2, '0')}:00:00.000Z`);

      sessionCheckCallsMap.push({
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

  console.log(`Prepared ${sessionsToInsert.length} ShiftSessions and ${sessionCheckCallsMap.length} CheckCalls.`);

  // Insert in chunks of 1000
  console.log('Inserting ShiftSessions...');
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < sessionsToInsert.length; i += CHUNK_SIZE) {
    const chunk = sessionsToInsert.slice(i, i + CHUNK_SIZE);
    await ShiftSession.insertMany(chunk);
    console.log(`  Inserted sessions ${i + 1} to ${Math.min(i + CHUNK_SIZE, sessionsToInsert.length)}`);
  }

  console.log('Inserting CheckCalls...');
  for (let i = 0; i < sessionCheckCallsMap.length; i += CHUNK_SIZE) {
    const chunk = sessionCheckCallsMap.slice(i, i + CHUNK_SIZE);
    await CheckCall.insertMany(chunk);
    console.log(`  Inserted check calls ${i + 1} to ${Math.min(i + CHUNK_SIZE, sessionCheckCallsMap.length)}`);
  }

  console.log('ALL HISTORICAL SESSIONS AND CHECK CALLS INSERTED SUCCESSFULLY!');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
