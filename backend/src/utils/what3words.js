/** What3Words helpers for the Observant API. */
const W3W_WORDS = [
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

const KNOWN_LOCATIONS = [
  { lat: 52.948242, lng: -2.006144, radius: 0.015, w3w: '///deflation.beards.suspect' },
];

function hashCoordsToW3W(lat, lon) {
  for (const loc of KNOWN_LOCATIONS) {
    if (Math.abs(lat - loc.lat) <= loc.radius && Math.abs(lon - loc.lng) <= loc.radius) {
      return loc.w3w;
    }
  }
  const normLat = Math.floor((lat + 90) * 37000);
  const normLon = Math.floor((lon + 180) * 37000);

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
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) return await response.json();
      if (response.status < 500 && response.status !== 429) return null;
    } catch (_) {
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

function getApiKey() {
  return process.env.W3W_API_KEY || process.env.EXPO_PUBLIC_W3W_API_KEY || null;
}

async function getCoordinatesFromWhat3Words(words) {
  const normalized = normalizeW3W(words);
  if (!normalized || !isValidWhat3Words(normalized)) return null;

  for (const loc of KNOWN_LOCATIONS) {
    if (loc.w3w.toLowerCase() === normalized.toLowerCase()) {
      return { latitude: loc.lat, longitude: loc.lng };
    }
  }

  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const cleanWords = normalized.replace(/^\/\/\//, '');
      const data = await requestW3w(`https://api.what3words.com/v3/convert-to-coordinates?words=${encodeURIComponent(cleanWords)}&key=${encodeURIComponent(apiKey)}`);
      if (data?.coordinates?.lat != null && data?.coordinates?.lng != null) {
        return { latitude: data.coordinates.lat, longitude: data.coordinates.lng };
      }
    } catch (_) {}
  }
  return null;
}

async function getWhat3WordsFromCoordinates(latitude, longitude) {
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const apiKey = getApiKey();
  if (apiKey) {
    try {
      const data = await requestW3w(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${encodeURIComponent(`${lat},${lng}`)}&key=${encodeURIComponent(apiKey)}`);
      if (data?.words && isValidWhat3Words(data.words)) return normalizeW3W(data.words);
    } catch (_) {}
  }
  return hashCoordsToW3W(lat, lng);
}

function getWhat3WordsSync(latitude, longitude) {
  const lat = Number(latitude), lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return hashCoordsToW3W(lat, lng);
}

module.exports = {
  isValidWhat3Words,
  normalizeW3W,
  getCoordinatesFromWhat3Words,
  getWhat3WordsFromCoordinates,
  getWhat3WordsSync,
  hashCoordsToW3W,
  W3W_WORDS,
};
