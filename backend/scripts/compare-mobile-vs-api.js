const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('../node_modules/mongoose');
const uri = process.env.MONGODB_URI || 'mongodb+srv://admin:admin123@cluster0.xalem4o.mongodb.net/ObservantApp?retryWrites=true&w=majority';

async function test() {
  await mongoose.connect(uri);
  const CheckCall = mongoose.connection.collection('checkcalls');
  const ShiftSession = mongoose.connection.collection('shiftsessions');
  const User = mongoose.connection.collection('users');
  const Site = mongoose.connection.collection('sites');

  const start = new Date('2026-11-16T00:00:00.000Z');
  const end = new Date('2026-11-23T00:00:00.000Z');

  const checkCalls = await CheckCall.find({
    firedAt: { $gte: start, $lt: end }
  }).toArray();
  const shiftSessions = await ShiftSession.find({}).toArray();
  const users = await User.find({}).toArray();
  const sites = await Site.find({}).toArray();

  const guardsMap = Object.fromEntries(users.map(u => [String(u._id), u]));
  const sitesMap = Object.fromEntries(sites.map(s => [String(s._id), s]));

  // Replicate mobile app buildChecklistRows:
  const groups = new Map();
  checkCalls.forEach(call => {
    const guard = guardsMap[String(call.guardId)];
    const site = sitesMap[String(call.siteId)];
    const at = new Date(call.promptTime || call.firedAt);
    if (!Number.isFinite(at.getTime())) return;

    const serviceDate = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
    const shift = at.getHours() >= 7 && at.getHours() < 19 ? 'Day' : 'Night';
    const session = shiftSessions.find(s => String(s._id) === String(call.sessionId));
    const key = [serviceDate, String(call.siteId), String(call.guardId), shift].join('|');
    if (!groups.has(key)) {
      groups.set(key, {
        serviceDate, siteName: site?.name || '—', guardName: guard?.name || '—',
        badgeNumber: guard?.badgeNumber || '—', shift,
        shiftTime: session ? `${session.scheduledStart || session.scheduledStartTime || ''}–${session.scheduledEnd || session.scheduledEndTime || ''}` : shift,
        slots: {}, notes: [],
      });
    }
    const row = groups.get(key);
    const hour = at.getHours();
    const slot = `${String(hour).padStart(2, '0')}00`;
    const isMissed = call.status === 'missed' || call.response === 'missed';
    const responseAt = call.respondedAt ? new Date(call.respondedAt) : null;
    const late = !isMissed && responseAt && responseAt - at > 15 * 60 * 1000;
    const exactTime = responseAt && Number.isFinite(responseAt.getTime())
      ? responseAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
      : at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' });
    const entry = isMissed ? `MISSED >15m (${exactTime})` : late ? `${exactTime} LATE` : exactTime;
    row.slots[slot] = row.slots[slot] ? `${row.slots[slot]}; ${entry}` : entry;
  });

  const mobileRows = [...groups.values()].sort((a, b) => a.serviceDate.localeCompare(b.serviceDate) || a.siteName.localeCompare(b.siteName) || a.guardName.localeCompare(b.guardName));

  console.log(`MOBILE APP CHECKLIST ROWS COUNT: ${mobileRows.length}`);
  mobileRows.forEach(r => {
    const slotsFilled = Object.entries(r.slots).map(([h, val]) => `${h}:${val}`).join(' ');
    console.log(`[${r.serviceDate}] ${r.siteName} | ${r.guardName} (${r.shift}) -> ${slotsFilled}`);
  });

  await mongoose.disconnect();
}
test().catch(console.error);
