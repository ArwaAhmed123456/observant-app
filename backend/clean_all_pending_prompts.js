require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { RandomPromptLog } = require('./src/models');

async function cleanPendingPrompts() {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await RandomPromptLog.updateMany(
    { responded: false },
    { $set: { responded: true, managerAlerted: true, respondedAt: new Date() } }
  );
  console.log(`Resolved ${res.modifiedCount} unresponded random prompt logs.`);
  await mongoose.disconnect();
}

cleanPendingPrompts().catch(console.error);
