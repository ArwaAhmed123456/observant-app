/**
 * Standalone keep-alive pinger for Render free tier.
 * Pings /health every 10 minutes using a registered cron-job.org job.
 *
 * Run ONCE to register the job: node keep-alive-ping.js
 * After that, cron-job.org keeps calling the server on its own.
 */
const https = require('https');

const PING_URL   = 'https://observant-api-zl49.onrender.com/health';
const CRON_API   = 'api.cron-job.org';
const EMAIL      = 'arwase46@gmail.com';
const PASSWORD   = 'ObservantPing2026!';

function request(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = https.request({ hostname: CRON_API, path, method, headers }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function getApiKey() {
  console.log('Logging in to cron-job.org...');
  const login = await request('POST', '/account/token', { login: EMAIL, password: PASSWORD }, '');
  if (login.status === 200 && (login.body.apiKey || login.body.token)) {
    const key = login.body.apiKey || login.body.token;
    console.log('✅ Login success, API key:', key.substring(0, 8) + '...');
    return key;
  }
  console.log('Login failed:', login.status, JSON.stringify(login.body).substring(0, 200));

  // Try registering a new account
  console.log('\nRegistering new cron-job.org account...');
  const reg = await request('PUT', '/account', {
    firstName: 'Observant', lastName: 'Security',
    email: EMAIL, password: PASSWORD,
    timezone: 'Europe/London', language: 'en',
  }, '');
  console.log('Register status:', reg.status, JSON.stringify(reg.body).substring(0, 200));
  if (reg.status === 200 || reg.status === 201) {
    console.log('✅ Account created! Check your email to confirm, then run this script again.');
    return null;
  }
  return null;
}

async function listJobs(apiKey) {
  const r = await request('GET', '/jobs', null, apiKey);
  return r.status === 200 ? (r.body.jobs || []) : [];
}

async function createJob(apiKey) {
  console.log('\nCreating keep-alive cron job...');
  const result = await request('PUT', '/jobs', {
    job: {
      url: PING_URL,
      enabled: true,
      title: 'Observant API Keep-Alive',
      schedule: {
        timezone: 'Europe/London',
        expiresAt: 0,
        hours:   [-1],                        // every hour
        mdays:   [-1],                        // every day
        minutes: [0, 10, 20, 30, 40, 50],    // every 10 minutes
        months:  [-1],
        wdays:   [-1],
      },
      requestTimeout: 30,
      requestMethod: 0,  // GET
    },
  }, apiKey);

  if (result.status === 200 || result.status === 201) {
    const id = result.body.jobId || result.body.job?.jobId;
    console.log(`✅ Keep-alive job created (ID: ${id}). Server will be pinged every 10 minutes.`);
  } else {
    console.error('❌ Failed to create job:', result.status, JSON.stringify(result.body).substring(0, 300));
  }
}

async function main() {
  const apiKey = await getApiKey();
  if (!apiKey) {
    console.log('\n⚠️  Could not get API key. Try:');
    console.log('  1. Visit https://cron-job.org and create a free account manually');
    console.log('  2. Add a job that GETs', PING_URL, 'every 10 minutes');
    return;
  }

  const existing = await listJobs(apiKey);
  const alreadyExists = existing.some(j => j.url === PING_URL || j.title?.includes('Observant'));
  if (alreadyExists) {
    console.log('✅ Keep-alive job already exists! Cron-job.org is already pinging the server.');
    console.log('   Jobs found:', existing.map(j => `"${j.title}" → ${j.url}`).join(', '));
  } else {
    await createJob(apiKey);
  }
}

main().catch(console.error);
