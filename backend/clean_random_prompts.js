const mongoose = require('mongoose');
require('dotenv').config();
const { RandomPromptLog, Alert } = require('./src/models');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const pending = await RandomPromptLog.find({ responded: false });
  console.log('Pending unacknowledged random prompts:', pending.length);
  await RandomPromptLog.updateMany({ responded: false }, { $set: { responded: true, managerAlerted: true, respondedAt: new Date() } });
  console.log('Marked all pending prompts as responded.');
  
  await Alert.deleteMany({});
  console.log('Cleared all alerts.');

  await mongoose.disconnect();
}
main().catch(console.error);
