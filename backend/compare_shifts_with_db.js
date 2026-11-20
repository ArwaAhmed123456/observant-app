const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config();
const { User, ShiftSession, CheckCall } = require('./src/models');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // Read extracted shifts
  const extracted = JSON.parse(fs.readFileSync('../scratch/extracted_1018_shifts.json', 'utf8'));
  console.log(`Loaded ${extracted.length} extracted shifts.`);

  const users = await User.find({ role: 'guard' });
  const userMap = new Map();
  users.forEach(u => userMap.set(u.name, u._id));

  const allSessions = await ShiftSession.find({}).populate('guardId', 'name');
  console.log(`Found ${allSessions.length} total sessions in DB.`);

  // Build a lookup set for DB sessions: `${date}_${guardName}_${shiftType}`
  const dbSessionKeys = new Set();
  allSessions.forEach(s => {
    if (!s.guardId) return;
    const dateStr = s.bookedOnAt.toISOString().slice(0, 10);
    const isDay = s.scheduledStart === '07:00' || (s.bookedOnAt.getUTCHours() >= 6 && s.bookedOnAt.getUTCHours() < 18);
    const type = isDay ? 'Day' : 'Night';
    dbSessionKeys.add(`${dateStr}_${s.guardId.name}_${type}`);
  });

  const missingFromDb = [];
  extracted.forEach(s => {
    const key = `${s.shiftDate}_${s.officerName}_${s.shiftType}`;
    if (!dbSessionKeys.has(key)) {
      missingFromDb.push(s);
    }
  });

  console.log(`Missing shifts from DB: ${missingFromDb.length}`);
  const missingByGuard = {};
  missingFromDb.forEach(s => {
    missingByGuard[s.officerName] = (missingByGuard[s.officerName] || 0) + 1;
  });
  console.log('Missing by guard:', missingByGuard);
  console.log('First 10 missing shifts:');
  missingFromDb.slice(0, 10).forEach(s => {
    console.log(`  ${s.shiftDate} ${s.officerName} (${s.shiftType}) tokens: ${s.tokens.filter(t => t !== '-').length}`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
