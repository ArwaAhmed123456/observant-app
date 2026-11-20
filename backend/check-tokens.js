require('dotenv').config();
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const User = require('./src/models/User');
  const mgrs = await User.find({ role: { $in: ['manager','admin','superadmin'] }, active: true })
    .select('name email role fcmToken notificationPreferences');
  mgrs.forEach(g => {
    const token = g.fcmToken ? g.fcmToken.substring(0,30)+'...' : 'NULL';
    const prefs = g.notificationPreferences || {};
    console.log(`${g.role} | ${g.name} | token: ${token} | routinePatrolPush: ${prefs.routinePatrolPush} | exceptionOnly: ${prefs.exceptionOnly}`);
  });
  mongoose.disconnect();
}).catch(e => console.error(e.message));

