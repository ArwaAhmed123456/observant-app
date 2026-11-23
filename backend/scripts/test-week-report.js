const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function test() {
  const loginRes = await fetch('https://observant-api-zl49.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@observant.com', password: 'Admin1234' })
  });
  const auth = await loginRes.json();
  const token = auth.accessToken;

  const res = await fetch('https://observant-api-zl49.onrender.com/api/reports/check-call-log?startDate=2026-11-16&endDate=2026-11-22', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const data = await res.json();
  console.log('Total rows returned by check-call-log:', (data.rows || []).length);
  for (const r of (data.rows || [])) {
    const filledSlots = r.hourlyChecks.filter(h => h.checks.length > 0);
    console.log(`${r.shiftDate} | ${r.siteName} | ${r.officerName} | Shift: ${r.shiftType} | checks count: ${filledSlots.length}`);
  }
}
test().catch(console.error);
