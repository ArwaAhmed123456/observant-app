require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { Alert } = require('./src/models');

async function cleanAlerts() {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await Alert.deleteMany({
    type: { $in: ['random_prompt_ignored', 'geofence_warning'] }
  });
  console.log(`Deleted ${res.deletedCount} exception alerts.`);
  await mongoose.disconnect();
}

cleanAlerts().catch(console.error);
