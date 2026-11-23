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
  }).sort({ firedAt: 1 }).toArray();

  const users = await User.find({}).toArray();
  const sites = await Site.find({}).toArray();
  const sessions = await ShiftSession.find({}).toArray();

  const userMap = new Map(users.map(u => [String(u._id), u]));
  const siteMap = new Map(sites.map(s => [String(s._id), s]));

  const DAY_HOURS   = ['0700','0800','0900','1000','1100','1200','1300','1400','1500','1600','1700','1800','1900'];
  const NIGHT_HOURS = ['1900','2000','2100','2200','2300','0000','0100','0200','0300','0400','0500','0600','0700'];

  function getSlotIndex(shiftType, hour) {
    if (shiftType === 'Day') {
      if (hour >= 7 && hour <= 19) return hour - 7;
      return -1;
    } else {
      if (hour >= 19) return hour - 19;
      if (hour <= 7) return hour + 5;
      return -1;
    }
  }

  const rowsMap = new Map();

  for (const call of checkCalls) {
    const guard = userMap.get(String(call.guardId));
    const site = siteMap.get(String(call.siteId));
    if (!guard || !site) continue;

    const at = new Date(call.respondedAt || call.firedAt);
    const hour = at.getUTCHours();
    const shiftType = (hour >= 7 && hour < 19) ? 'Day' : 'Night';
    
    // For night shift between 00:00 and 07:00, date belongs to previous evening shift
    const shiftDateObj = new Date(at);
    if (shiftType === 'Night' && hour < 7) {
      shiftDateObj.setUTCDate(shiftDateObj.getUTCDate() - 1);
    }
    const shiftDate = shiftDateObj.toISOString().slice(0, 10);

    const key = `${shiftDate}|${site._id}|${guard._id}|${shiftType}`;
    if (!rowsMap.has(key)) {
      const hoursList = shiftType === 'Day' ? DAY_HOURS : NIGHT_HOURS;
      rowsMap.set(key, {
        siteId: String(site._id),
        siteName: site.name,
        officerId: String(guard._id),
        officerName: guard.name,
        badgeNumber: guard.badgeNumber,
        shiftDate,
        shiftType,
        shiftTimes: shiftType === 'Day' ? '07:00–19:00' : '19:00–07:00',
        hourlyChecks: hoursList.map(h => ({ hour: h, checks: [] }))
      });
    }

    const row = rowsMap.get(key);
    const slotIdx = getSlotIndex(shiftType, hour);
    if (slotIdx >= 0 && slotIdx < 13) {
      const timeStr = `${String(at.getUTCHours()).padStart(2, '0')}:${String(at.getUTCMinutes()).padStart(2, '0')}`;
      row.hourlyChecks[slotIdx].checks.push({
        id: String(call._id),
        time: timeStr,
        response: call.response || 'yes',
        note: call.note || null
      });
    }
  }

  const rows = [...rowsMap.values()].sort((a, b) => 
    a.shiftDate.localeCompare(b.shiftDate) || 
    a.siteName.localeCompare(b.siteName) || 
    (a.shiftType === 'Day' ? -1 : 1) ||
    a.officerName.localeCompare(b.officerName)
  );

  console.log('TOTAL GENERATED ROWS:', rows.length);
  rows.forEach(r => {
    const filled = r.hourlyChecks.filter(h => h.checks.length > 0).map(h => `${h.hour}:${h.checks.map(c => c.time).join(';')}`).join(' ');
    console.log(`[${r.shiftDate}] ${r.siteName} | ${r.officerName} (${r.shiftType}) -> ${filled}`);
  });

  await mongoose.disconnect();
}
test().catch(console.error);
