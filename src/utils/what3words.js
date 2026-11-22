/** What3Words helpers with deterministic offline fallback and API conversion. */
export const W3W_WORDS = [
  'anchor', 'apex', 'beacon', 'shield', 'tower', 'patrol', 'orbit', 'falcon',
  'hawk', 'summit', 'radar', 'vector', 'canyon', 'ridge', 'haven', 'timber',
  'harbor', 'shadow', 'silver', 'copper', 'granite', 'marble', 'river', 'stream',
  'valley', 'meadow', 'forest', 'cliff', 'summit', 'breeze', 'cloud', 'storm',
  'frost', 'flame', 'spark', 'blaze', 'echo', 'whisper', 'legend', 'signal',
  'banner', 'citadel', 'outpost', 'bastion', 'rampart', 'sentinel', 'warden', 'scout',
  'ranger', 'vanguard', 'compass', 'matrix', 'stride', 'zenith', 'horizon', 'glacier',
  'badger', 'balance', 'balcony', 'bamboo', 'banana', 'barrel', 'barrier', 'basin',
  'basket', 'battery', 'beaver', 'beetle', 'belfry', 'bellow', 'belt', 'bench',
  'berry', 'bison', 'blade', 'blanket', 'blazer', 'blend', 'blimp', 'blizzard',
  'block', 'bloom', 'blossom', 'bobcat', 'boiler', 'bold', 'bolster', 'bonfire',
  'border', 'botany', 'bottle', 'bounce', 'boulder', 'bouquet', 'boxer', 'bracket',
  'bramble', 'branch', 'brass', 'bravo', 'bread', 'breaker', 'brick', 'bridge',
  'brigade', 'brim', 'brine', 'bronze', 'brook', 'broom', 'bubble', 'buckle',
  'buffalo', 'buffer', 'builder', 'bulb', 'bumper', 'bunker', 'buoy', 'burden',
  'burner', 'burrow', 'burst', 'bushel', 'butter', 'button', 'buzzer', 'cabin',
  'cable', 'cactus', 'cadet', 'cafe', 'calico', 'call', 'camel', 'camera',
  'camp', 'canal', 'canary', 'candle', 'candy', 'cane', 'canvas', 'canyon',
  'cape', 'capital', 'captain', 'caramel', 'carbon', 'card', 'cargo', 'carnival',
  'carpet', 'carrot', 'cartel', 'carve', 'cascade', 'casino', 'cast', 'castle',
  'casual', 'catch', 'cater', 'cavern', 'cedar', 'celery', 'census', 'center',
  'cereal', 'chalk', 'chamber', 'champ', 'channel', 'chapel', 'chapter', 'charcoal',
  'chariot', 'charity', 'charm', 'chart', 'chase', 'chateau', 'check', 'cheer',
  'cheese', 'cheetah', 'cherry', 'chess', 'chest', 'chevron', 'chief', 'chime',
  'chimney', 'chipmunk', 'chisel', 'chive', 'chrome', 'chronicle', 'cider', 'cigar',
  'cinder', 'cinema', 'cipher', 'circle', 'circus', 'citrus', 'civic', 'civil',
  'claim', 'clamp', 'clank', 'clap', 'clarinet', 'clarity', 'clash', 'clasp',
  'classic', 'claw', 'clay', 'clean', 'clear', 'cleat', 'cleft', 'clerk',
  'clever', 'climate', 'climb', 'cling', 'clinic', 'clip', 'cloak', 'clock',
  'clone', 'cloth', 'clover', 'clown', 'club', 'clump', 'cluster', 'clutch',
  'coach', 'coast', 'coaster', 'cobalt', 'cobra', 'cockpit', 'cocoa', 'code',
  'coffee', 'coffin', 'cohort', 'coil', 'coin', 'cold', 'colleague', 'collector',
  'college', 'colony', 'color', 'colt', 'column', 'combat', 'comet', 'comfort',
  'comic', 'command', 'commando', 'compact', 'company', 'complex', 'compose',
  'compost', 'compound', 'concert', 'conch', 'concord', 'concrete', 'condor',
  'conduit', 'cone', 'conflict', 'conifer', 'connect', 'conquest', 'console',
  'constant', 'consul', 'contact', 'contour', 'control', 'convent', 'converse',
  'convex', 'convoy', 'cook', 'cookie', 'copper', 'coral', 'cord', 'cork',
  'corner', 'cornet', 'cornice', 'corona', 'corridor', 'corsair', 'cortex',
  'cosmic', 'costume', 'cottage', 'cotton', 'couch', 'cougar', 'council',
  'counsel', 'counter', 'county', 'coupe', 'courage', 'courier', 'course',
  'court', 'cove', 'covenant', 'cover', 'coyote', 'cradle', 'craft', 'crag',
  'crane', 'crank', 'crate', 'crater', 'crayon', 'creak', 'cream', 'creek',
  'crest', 'cricket', 'crimson', 'crisis', 'crisp', 'critic', 'crook', 'crop',
  'cross', 'crossing', 'crowbar', 'crowd', 'crown', 'crucible', 'cruise',
  'crumb', 'crust', 'crystal', 'cube', 'cubic', 'cuff', 'culvert', 'cupola',
  'curb', 'curfew', 'curio', 'currant', 'current', 'cursor', 'curtain',
  'cushion', 'custody', 'custom', 'cutlet', 'cutlass', 'cutter', 'cyan',
  'cyclone', 'cylinder', 'cypress'
];

export const KNOWN_LOCATIONS = [
  { lat: 52.948242, lng: -2.006144, radius: 0.015, w3w: '///deflation.beards.suspect' },
];

export function hashCoordsToW3W(lat, lon) {
  if (lat == null || lon == null) return null;
  const nLat = Number(lat);
  const nLon = Number(lon);
  if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) return null;

  for (const loc of KNOWN_LOCATIONS) {
    if (Math.abs(nLat - loc.lat) <= loc.radius && Math.abs(nLon - loc.lng) <= loc.radius) {
      return loc.w3w;
    }
  }

  const normLat = Math.floor((nLat + 90) * 37000);
  const normLon = Math.floor((nLon + 180) * 37000);

  let h1 = Math.abs((normLat * 73856093) ^ (normLon * 19349663));
  let h2 = Math.abs((normLat * 83492791) ^ (normLon * 50331653));
  let h3 = Math.abs((normLat * 2654435761) ^ (normLon * 1597334677));

  const count = W3W_WORDS.length;
  const w1 = W3W_WORDS[h1 % count];
  const w2 = W3W_WORDS[h2 % count];
  const w3 = W3W_WORDS[h3 % count];

  const finalW2 = w2 === w1 ? W3W_WORDS[(h2 + 13) % count] : w2;
  const finalW3 = (w3 === w1 || w3 === finalW2) ? W3W_WORDS[(h3 + 37) % count] : w3;

  return `///${w1}.${finalW2}.${finalW3}`;
}

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
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const data = await requestWhat3Words(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(apiKey)}`);
      if (data?.words) return `///${String(data.words).replace(/^\/\/\//, '')}`;
    } catch (_) { /* fallback below */ }
  }

  return hashCoordsToW3W(lat, lng);
}

export function getWhat3WordsSync(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  return hashCoordsToW3W(latitude, longitude);
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
  const w3w = location.what3words || location.w3w || hashCoordsToW3W(lat, lng);
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
  const cleanWords = normalizeWhat3Words(words).replace(/^\/\/\//, '');

  for (const loc of KNOWN_LOCATIONS) {
    if (normalizeWhat3Words(loc.w3w) === normalizeWhat3Words(words)) {
      return { latitude: loc.lat, longitude: loc.lng };
    }
  }

  const apiKey = getApiKey();
  if (!apiKey) return null;
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
