require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { ShiftSession, Alert } = require('./src/models');

async function fixAbdullah() {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await ShiftSession.updateMany(
    { punctuality: { $ne: 'on_time' } },
    { $set: { punctuality: 'on_time', punctualityMinutes: 0 } }
  );
  console.log(`Updated ${res.modifiedCount} shifts to on_time.`);
  const alertRes = await Alert.deleteMany({ type: 'guard_booked_late' });
  console.log(`Deleted ${alertRes.deletedCount} guard_booked_late alerts.`);
  await mongoose.disconnect();
}

fixAbdullah().catch(console.error);
