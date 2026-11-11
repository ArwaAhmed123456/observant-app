const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const statePath = path.join(process.env.USERPROFILE, '.expo', 'state.json');
const session = JSON.parse(fs.readFileSync(statePath, 'utf8')).auth.sessionSecret;
const accountId = '4bc1e3ed-7e8b-45d1-98a9-119d40f495eb';
const APP_ID = '6819709526';

function gql(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const req = https.request({
      hostname: 'api.expo.dev', path: '/graphql', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'expo-session': session, 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

function makeJWT(keyId, issuerId, privateKey) {
  const header  = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' })).toString('base64url');
  const data    = `${header}.${payload}`;
  const sig     = crypto.createSign('SHA256').update(data).sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }, 'base64url');
  return `${data}.${sig}`;
}

function asc(method, urlPath, jwt, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.appstoreconnect.apple.com', path: urlPath, method,
      headers: {
        Authorization: `Bearer ${jwt}`,
        'Content-Type': 'application/json',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
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
  // Step 1: Get ASC key with p8 content from EAS
  console.log('Fetching ASC API key from EAS...');
  const r = await gql(`{
    account {
      byId(accountId: "${accountId}") {
        appStoreConnectApiKeys {
          id keyIdentifier issuerIdentifier keyP8 name
        }
      }
    }
  }`);

  const keys = r.data.account.byId.appStoreConnectApiKeys;
  const ascKey = keys.find(k => k.name && k.name.includes('EAS Submit')) || keys[0];
  console.log('Using key:', ascKey.name, '| ID:', ascKey.keyIdentifier, '| Issuer:', ascKey.issuerIdentifier);

  const jwt = makeJWT(ascKey.keyIdentifier, ascKey.issuerIdentifier, ascKey.keyP8);

  // Step 2: Get builds for v1.0.1
  console.log('\nFetching builds...');
  const builds = await asc('GET', `/v1/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate`, jwt);
  if (builds.status !== 200) { console.log('Error:', JSON.stringify(builds.body).substring(0, 300)); return; }

  const buildList = builds.body.data || [];
  console.log(`Found ${buildList.length} build(s) for v1.0.1:`);
  buildList.forEach(b => console.log(`  Build ${b.attributes.buildNumber} — ${b.attributes.processingState} — id: ${b.id}`));

  const build = buildList.find(b => b.attributes.processingState === 'VALID') || buildList[0];
  if (!build) { console.log('No valid build found.'); return; }
  console.log(`\nUsing build ${build.attributes.buildNumber} (${build.id})`);

  // Step 3: Get internal beta groups
  console.log('\nFetching internal beta groups...');
  const groups = await asc('GET', `/v1/apps/${APP_ID}/betaGroups`, jwt);
  if (groups.status !== 200) { console.log('Error:', JSON.stringify(groups.body).substring(0, 300)); return; }

  const groupList = groups.body.data || [];
  console.log(`Found ${groupList.length} internal group(s):`);
  groupList.forEach(g => console.log(`  "${g.attributes.name}" — id: ${g.id}`));

  // Step 4: Add build to each internal group
  for (const group of groupList) {
    console.log(`\nAdding build to "${group.attributes.name}"...`);
    const result = await asc('POST', `/v1/betaGroups/${group.id}/relationships/builds`, jwt, {
      data: [{ type: 'builds', id: build.id }]
    });
    if (result.status === 204 || result.status === 200) console.log(`  ✅ Added!`);
    else console.log(`  ❌ Failed (${result.status}):`, JSON.stringify(result.body).substring(0, 200));
  }

  // Step 5: Mark usesNonExemptEncryption false so build is ready immediately
  console.log('\nMarking encryption compliance...');
  const patch = await asc('PATCH', `/v1/builds/${build.id}`, jwt, {
    data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } }
  });
  console.log('Status:', patch.status === 200 ? '✅ OK' : `❌ ${patch.status}`);
  console.log('\n✅ Done — open TestFlight on your iPhone and refresh.');
}

main().catch(console.error);
