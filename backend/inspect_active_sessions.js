require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { ShiftSession, User } = require('./src/models');

async function inspectActiveSessions() {
  await mongoose.connect(process.env.MONGODB_URI);
  const active = await ShiftSession.find({ bookedOffAt: null }).populate('guardId', 'name email');
  console.log(`Found ${active.length} active sessions:`);
  active.forEach(s => {
    console.log({
      id: s._id,
      guard: s.guardId?.name,
      bookedOnAt: s.bookedOnAt,
      scheduledEndAt: s.scheduledEndAt,
      nextCheckCallAt: s.nextCheckCallAt,
      nextRandomPromptAt: s.nextRandomPromptAt,
      randomPromptCount: s.randomPromptCount
    });
  });
  await mongoose.disconnect();
}

inspectActiveSessions().catch(console.error);
