const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('../node_modules/mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.xalem4o.mongodb.net/ObservantApp?retryWrites=true&w=majority';

async function check() {
  await mongoose.connect(uri);
  const CheckCall = mongoose.connection.collection('checkcalls');
  const ShiftSession = mongoose.connection.collection('shiftsessions');
  const User = mongoose.connection.collection('users');
  const Site = mongoose.connection.collection('sites');

  const start = new Date('2026-11-16T00:00:00.000Z');
  const end = new Date('2026-11-23T00:00:00.000Z');

  const calls = await CheckCall.find({
    firedAt: { $gte: start, $lt: end }
  }).toArray();
  console.log('CheckCalls count between 16/11 and 22/11:', calls.length);

  const sessions = await ShiftSession.find({
    bookedOnAt: { $gte: start, $lt: end }
  }).toArray();
  console.log('ShiftSessions count between 16/11 and 22/11:', sessions.length);

  // Users and Sites
  const userMap = new Map((await User.find({}).toArray()).map(u => [String(u._id), u.name]));
  const siteMap = new Map((await Site.find({}).toArray()).map(s => [String(s._id), s.name]));

  const summary = {};
  for (const c of calls) {
    const d = c.firedAt ? new Date(c.firedAt).toISOString().slice(0, 10) : 'no-date';
    const g = userMap.get(String(c.guardId)) || String(c.guardId);
    const s = siteMap.get(String(c.siteId)) || String(c.siteId);
    const key = d + ' | ' + s + ' | ' + g;
    summary[key] = (summary[key] || 0) + 1;
  }
  console.log('\nCalls summary by day/site/guard:');
  console.log(summary);

  console.log('\nSessions:');
  for (const s of sessions) {
    console.log({
      id: s._id,
      guard: userMap.get(String(s.guardId)),
      site: siteMap.get(String(s.siteId)),
      bookedOnAt: s.bookedOnAt,
      bookedOffAt: s.bookedOffAt,
      scheduledStart: s.scheduledStart,
      scheduledEnd: s.scheduledEnd
    });
  }

  await mongoose.disconnect();
}
check().catch(console.error);
