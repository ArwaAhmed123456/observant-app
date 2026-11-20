/**
 * Creates a free cron-job.org job that pings the Render server
 * every 10 minutes to prevent it from sleeping.
 * Run once: node setup-cronjob.js
 */
const https = require('https');

// cron-job.org API — create a free account at https://cron-job.org
// and paste your API key here, OR we register anonymously via the public API
const PING_URL = 'https://observant-api-zl49.onrender.com/health';

function request(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.cron-job.org',
      path, method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function main() {
  // Step 1: Register a free account
  console.log('Registering free cron-job.org account...');
  const reg = await request('PUT', '/account', {
    firstName: 'Observant',
    lastName: 'Security',
    email: 'arwase46@gmail.com',
    password: 'ObservantPing2026!',
    timezone: 'Europe/London',
    language: 'en',
  }, '');

  console.log('Register status:', reg.status);
  if (reg.status === 200 || reg.status === 201) {
    console.log('Account created. Check arwase46@gmail.com to confirm.');
  } else {
    console.log('Response:', JSON.stringify(reg.body).substring(0, 300));
    // May already exist — try login
    console.log('\nTrying login...');
    const login = await request('POST', '/account/token', {
      login: 'arwase46@gmail.com',
      password: 'ObservantPing2026!',
    }, '');
    console.log('Login status:', login.status);
    if (login.status !== 200) { console.log(JSON.stringify(login.body)); return; }
    const apiKey = login.body.apiKey || login.body.token;
    console.log('API Key obtained:', apiKey?.substring(0, 10) + '...');
    await createJob(apiKey);
  }
}

async function createJob(apiKey) {
  console.log('\nCreating ping job...');
  const result = await request('PUT', '/jobs', {
    job: {
      url: PING_URL,
      enabled: true,
      title: 'Observant API Keep-Alive',
      schedule: {
        timezone: 'Europe/London',
        expiresAt: 0,
        hours: [-1],       // every hour
        mdays: [-1],       // every day
        minutes: [0, 10, 20, 30, 40, 50], // every 10 minutes
        months: [-1],
        wdays: [-1],
      },
      requestTimeout: 30,
      requestMethod: 0,   // GET
    }
  }, apiKey);

  console.log('Create job status:', result.status);
  console.log(JSON.stringify(result.body).substring(0, 300));
  if (result.status === 200 || result.status === 201) {
    console.log('\n✅ Keep-alive cron job created! Server will be pinged every 10 minutes.');
  }
}

main().catch(console.error);
