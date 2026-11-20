const mongoose = require('mongoose');
require('dotenv').config();
const { User, ShiftSession, RandomPromptLog, Alert, PatrolSession } = require('./src/models');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB Atlas.');

  const waqar = await User.findOne({ name: /Waqar/i });
  console.log('Waqar ID:', waqar ? waqar._id : 'not found');

  // Mark all RandomPromptLogs as responded / green
  const updatedPrompts = await RandomPromptLog.updateMany(
    {},
    {
      $set: {
        responded: true,
        respondedAt: new Date(),
        managerAlerted: false,
      }
    }
  );
  console.log(`Updated ${updatedPrompts.modifiedCount} RandomPromptLogs to responded: true.`);

  // Clear nextRandomPromptAt on all sessions so no surprise patrol will be scheduled
  const updatedSessions = await ShiftSession.updateMany(
    { bookedOffAt: null },
    {
      $set: {
        nextRandomPromptAt: null,
      }
    }
  );
  console.log(`Cleared nextRandomPromptAt on ${updatedSessions.modifiedCount} active ShiftSessions.`);

  // Delete all alerts from DB
  const deletedAlerts = await Alert.deleteMany({});
  console.log(`Deleted ${deletedAlerts.deletedCount} alerts from DB.`);

  console.log('Database cleanup completed successfully.');
  await mongoose.disconnect();
}

main().catch(console.error);
