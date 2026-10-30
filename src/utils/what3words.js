/** What3Words helpers. Coordinates are never converted to synthetic three-word labels. */
const getApiKey = () => (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_W3W_API_KEY)
  || (typeof process !== 'undefined' && process.env?.W3W_API_KEY)
  || null;

async function requestWhat3Words(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return await response.json();
      if (response.status < 500 && response.status !== 429) return null;
      const retryAfter = Number(response.headers?.get?.('retry-after'));
      const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 2000) : [300, 800][attempt] || 800;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, delay));
    } catch (_) {
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, [300, 800][attempt]));
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

export async function getWhat3Words(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  const apiKey = getApiKey();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !apiKey) return null;
  const data = await requestWhat3Words(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(apiKey)}`);
  return data?.words ? `///${String(data.words).replace(/^\/\/\//, '')}` : null;
}

// A synchronous official conversion is not available; return no address instead of inventing one.
export function getWhat3WordsSync() {
  return null;
}

export function formatLocationTelemetry(location) {
  if (!location || location.latitude == null || location.longitude == null) {
    return {
      hasGps: false, latitude: null, longitude: null, altitude: null, w3w: null,
      displayCoords: 'No GPS data', displayAltitude: 'Alt: —', summary: 'Location unavailable',
    };
  }
  const lat = Number(location.latitude);
  const lng = Number(location.longitude);
  const altitude = location.altitude != null ? Number(location.altitude) : null;
  const w3w = location.what3words || location.w3w || null;
  const altitudeLabel = altitude != null ? `${Math.round(altitude)}m` : null;
  const summary = [w3w, altitudeLabel, `${lat.toFixed(4)}, ${lng.toFixed(4)}`].filter(Boolean).join(' · ');
  return {
    hasGps: true, latitude: lat, longitude: lng, altitude, w3w,
    latStr: `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`,
    lonStr: `${Math.abs(lng).toFixed(5)}° ${lng >= 0 ? 'E' : 'W'}`,
    displayCoords: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    displayAltitude: altitudeLabel ? `Alt: ${altitudeLabel}` : 'Alt: —',
    summary,
  };
}

export function normalizeWhat3Words(w3w) {
  if (!w3w || typeof w3w !== 'string') return null;
  const clean = w3w.trim()
    .replace(/^\/+/, '')
    .replace(/^https?:\/\/(?:www\.)?what3words\.com\//i, '')
    .split(/[?#]/, 1)[0].replace(/^\/+/, '').replace(/\/+$/, '').toLowerCase();
  return clean ? `///${clean}` : null;
}

export function isValidWhat3Words(w3w) {
  const normalized = normalizeWhat3Words(w3w);
  return Boolean(normalized && /^\/\/\/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+$/.test(normalized));
}

export function isValidCoordinates(lat, lng) {
  if (lat == null || lng == null) return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  return Number.isFinite(nLat) && Number.isFinite(nLng) && nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
}

export async function getCoordinatesFromWhat3Words(words) {
  if (!isValidWhat3Words(words)) return null;
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const cleanWords = normalizeWhat3Words(words).replace(/^\/\/\//, '');
  const data = await requestWhat3Words(`https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(cleanWords)}&key=${encodeURIComponent(apiKey)}`);
  const coordinates = data?.coordinates;
  return coordinates?.lat != null && coordinates?.lng != null
    ? { latitude: coordinates.lat, longitude: coordinates.lng }
    : null;
}

export function getMapUrl(lat, lng) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lng)}`;
}
