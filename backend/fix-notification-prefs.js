// One-time migration: enable routinePatrolPush for all existing managers
// who have never changed their preferences (default was false, should be true)
require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require('./src/models/User');
  
  // Enable patrol push for ALL managers/admins who still have the old default (false)
  const result = await User.updateMany(
    { 
      role: { $in: ['manager', 'admin', 'superadmin'] },
      active: true,
      'notificationPreferences.routinePatrolPush': { $ne: true }
    },
    { $set: { 'notificationPreferences.routinePatrolPush': true } }
  );
  console.log(`Updated ${result.modifiedCount} manager(s) to enable patrol push notifications`);

  // Show updated state
  const mgrs = await User.find({ role: { $in: ['manager','admin','superadmin'] }, active: true })
    .select('name role fcmToken notificationPreferences');
  mgrs.forEach(g => {
    const token = g.fcmToken ? '✅ token set' : '❌ NULL';
    const prefs = g.notificationPreferences || {};
    console.log(`${g.role} | ${g.name} | ${token} | routinePatrolPush: ${prefs.routinePatrolPush}`);
  });

  mongoose.disconnect();
}).catch(e => { console.error(e.message); process.exit(1); });

