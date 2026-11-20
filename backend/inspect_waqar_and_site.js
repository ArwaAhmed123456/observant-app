require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const { User, ShiftSession, PatrolSession, CheckCall, Site } = require('./src/models');

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const waqar = await User.findOne({ name: /waqar/i });
  console.log('Waqar user:', waqar ? { id: waqar._id, name: waqar.name, email: waqar.email, role: waqar.role, siteId: waqar.siteId, assignedSiteIds: waqar.assignedSiteIds } : 'Not found');

  if (waqar) {
    const activeSessions = await ShiftSession.find({ guardId: waqar._id, bookedOffAt: null });
    console.log('Active shift sessions for Waqar:', activeSessions);

    const latestSessions = await ShiftSession.find({ guardId: waqar._id }).sort({ bookedOnAt: -1 }).limit(5);
    console.log('Latest 5 sessions for Waqar:', latestSessions.map(s => ({
      id: s._id,
      bookedOnAt: s.bookedOnAt,
      bookedOffAt: s.bookedOffAt,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd,
      scheduledEndAt: s.scheduledEndAt,
      autoEnded: s.autoEnded
    })));
  }

  const totmonslow = await Site.findOne({ name: /totmonslow/i });
  console.log('Totmonslow Site:', totmonslow ? {
    id: totmonslow._id,
    name: totmonslow.name,
    latitude: totmonslow.latitude,
    longitude: totmonslow.longitude,
    location: totmonslow.location,
    geofenceRadiusMetres: totmonslow.geofenceRadiusMetres
  } : 'Not found');

  await mongoose.disconnect();
}

inspect().catch(console.error);
