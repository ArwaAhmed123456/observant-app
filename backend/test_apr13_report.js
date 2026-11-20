const mongoose = require('mongoose');
require('dotenv').config();
const { User, ShiftSession, CheckCall, Site } = require('./src/models');

async function testReport() {
  await mongoose.connect(process.env.MONGODB_URI);
  const site = await Site.findOne({ name: /Totmonslow/i });
  
  // Date range 2026-04-13 to 2026-04-19
  const start = new Date('2026-04-13T00:00:00.000Z');
  const end = new Date('2026-04-20T00:00:00.000Z');

  const sessions = await ShiftSession.find({
    siteId: site._id,
    bookedOnAt: { $gte: start, $lt: end },
  }).populate('guardId', 'name').sort({ bookedOnAt: 1 });

  console.log(`Found ${sessions.length} sessions for 2026-04-13 to 2026-04-19.`);
  
  // Group by day
  const byDay = {};
  sessions.forEach(s => {
    const d = s.bookedOnAt.toISOString().slice(0, 10);
    if (!byDay[d]) byDay[d] = [];
    const isDay = s.scheduledStart === '07:00' || (s.bookedOnAt.getUTCHours() >= 6 && s.bookedOnAt.getUTCHours() < 18);
    byDay[d].push(`${s.guardId ? s.guardId.name : 'Unknown'} (${isDay ? 'Day' : 'Night'})`);
  });

  for (const [day, list] of Object.entries(byDay)) {
    console.log(day, ':', list.join(', '));
  }

  await mongoose.disconnect();
}

testReport().catch(console.error);
