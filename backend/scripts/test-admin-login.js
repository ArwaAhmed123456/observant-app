const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function test() {
  const loginRes = await fetch('https://observant-api-zl49.onrender.com/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@observant.com', password: 'Admin1234' })
  });
  console.log('ADMIN LOGIN STATUS:', loginRes.status);
  const auth = await loginRes.json();
  const token = auth.accessToken;
  console.log('LOGGED IN AS:', auth.user?.name, auth.user?.role);

  const [users, sites, rosters] = await Promise.all([
    fetch('https://observant-api-zl49.onrender.com/api/users', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    fetch('https://observant-api-zl49.onrender.com/api/sites', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    fetch('https://observant-api-zl49.onrender.com/api/rosters', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
  ]);

  console.log('USERS count:', (users.users || []).length);
  console.log('SITES count:', (sites.sites || []).length);
  console.log('ALL ROSTERS count:', (rosters.rosters || []).length);
}
test().catch(console.error);
