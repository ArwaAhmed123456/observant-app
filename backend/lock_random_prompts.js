const mongoose = require('mongoose');
require('dotenv').config();
const { Alert, RandomPromptLog, ShiftSession } = require('./src/models');

async function fix() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  // 1. Delete all alerts
  const del = await Alert.deleteMany({});
  console.log('Deleted alerts:', del.deletedCount);

  // 2. Mark all RandomPromptLogs as responded: true, managerAlerted: true
  const pUp = await RandomPromptLog.updateMany({}, {
    $set: { responded: true, managerAlerted: true, respondedAt: new Date() }
  });
  console.log('Updated RandomPromptLogs:', pUp.modifiedCount);

  // 3. Set nextRandomPromptAt to 2099-01-01 on all active sessions so the old worker never matches
  // null (to schedule) or <= now (to fire)
  const sUp = await ShiftSession.updateMany(
    { bookedOffAt: null },
    { $set: { nextRandomPromptAt: new Date('2099-01-01T00:00:00.000Z') } }
  );
  console.log('Set nextRandomPromptAt to 2099 on active sessions:', sUp.modifiedCount);

  await mongoose.disconnect();
}
fix().catch(console.error);
