/** What3Words helpers for the Observant API. Never fabricate an address from coordinates. */
function isValidWhat3Words(w3w) {
  if (!w3w || typeof w3w !== 'string') return false;
  const clean = w3w.trim().replace(/^\/\/\//, '');
  return /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+$/.test(clean);
}

function normalizeW3W(w3w) {
  if (!w3w) return null;
  const clean = String(w3w).trim()
    .replace(/^\/+/, '')
    .replace(/^https?:\/\/(?:www\.)?what3words\.com\//i, '')
    .split(/[?#]/, 1)[0]
    .replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  return clean ? `///${clean}` : null;
}

async function requestW3w(url) {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return await response.json();
      lastStatus = response.status;
      let apiCode = null;
      try { apiCode = (await response.json())?.error?.code || null; } catch (_) { /* Non-JSON error response. */ }
      console.warn(`[What3Words] API returned HTTP ${response.status}${apiCode ? ` (${apiCode})` : ''}.`);
      if (response.status < 500 && response.status !== 429) return null;
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0
        ? Math.min(retryAfter * 1000, 2000)
        : [300, 900][attempt] || 900;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, delay));
    } catch (_) {
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, [300, 900][attempt]));
    } finally {
      clearTimeout(timeout);
    }
  }
  console.warn(`[What3Words] Lookup failed after retries${lastStatus ? ` (HTTP ${lastStatus})` : ''}.`);
  return null;
}

function getApiKey() {
  return process.env.W3W_API_KEY || process.env.EXPO_PUBLIC_W3W_API_KEY || null;
}

async function getCoordinatesFromWhat3Words(words) {
  const normalized = normalizeW3W(words);
  if (!normalized || !isValidWhat3Words(normalized)) return null;
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const cleanWords = normalized.replace(/^\/\/\//, '');
  const data = await requestW3w(`https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(cleanWords)}&key=${encodeURIComponent(apiKey)}`);
  if (data?.coordinates?.lat == null || data?.coordinates?.lng == null) return null;
  return { latitude: data.coordinates.lat, longitude: data.coordinates.lng };
}

async function getWhat3WordsFromCoordinates(latitude, longitude) {
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const data = await requestW3w(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(apiKey)}`);
  return data?.words && isValidWhat3Words(data.words) ? normalizeW3W(data.words) : null;
}

// Synchronous official conversion is not available; callers should store no W3W value.
function getWhat3WordsSync() {
  return null;
}

module.exports = { isValidWhat3Words, normalizeW3W, getCoordinatesFromWhat3Words, getWhat3WordsFromCoordinates, getWhat3WordsSync };
