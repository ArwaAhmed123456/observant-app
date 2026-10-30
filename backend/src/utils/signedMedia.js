const crypto = require('crypto');

function mediaSecret() {
  return process.env.MEDIA_LINK_SECRET || process.env.JWT_SECRET || null;
}

function createSignedMediaUrl(photoUrl, organisationId, lifetimeSeconds = 72 * 60 * 60) {
  const secret = mediaSecret();
  if (!secret || !photoUrl || !organisationId) return null;
  try {
    const url = new URL(photoUrl);
    const match = url.pathname.match(/\/api\/media\/([a-f\d]{24})\/?$/i);
    if (!match) return null;
    const id = match[1];
    const org = String(organisationId);
    const expires = Math.floor(Date.now() / 1000) + lifetimeSeconds;
    const signature = crypto.createHmac('sha256', secret).update(`${id}.${org}.${expires}`).digest('hex');
    url.searchParams.set('org', org);
    url.searchParams.set('expires', String(expires));
    url.searchParams.set('signature', signature);
    return url.toString();
  } catch (_) {
    return null;
  }
}

function verifySignedMedia(id, organisationId, expires, signature) {
  const secret = mediaSecret();
  const expiry = Number(expires);
  if (!secret || !id || !organisationId || !Number.isInteger(expiry) || expiry <= Math.floor(Date.now() / 1000) || !/^[a-f\d]{64}$/i.test(String(signature || ''))) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${id}.${organisationId}.${expiry}`).digest();
  const actual = Buffer.from(String(signature), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { createSignedMediaUrl, verifySignedMedia };
