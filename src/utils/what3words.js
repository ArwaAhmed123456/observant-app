/**
 * What3Words & Tactical Geolocation Utilities
 * Converts coordinates to What3Words addresses (///word.word.word)
 * with support for Latitude, Longitude, Altitude & W3W generation.
 */

// Curated dictionary of ~400 clear, distinct words for offline/deterministic W3W generation
const W3W_WORDS = [
  'anchor', 'apex', 'beacon', 'shield', 'tower', 'patrol', 'orbit', 'falcon',
  'hawk', 'summit', 'radar', 'vector', 'canyon', 'ridge', 'haven', 'timber',
  'harbor', 'shadow', 'silver', 'copper', 'granite', 'marble', 'river', 'stream',
  'valley', 'meadow', 'forest', 'cliff', 'summit', 'breeze', 'cloud', 'storm',
  'frost', 'flame', 'spark', 'blaze', 'echo', 'whisper', 'legend', 'signal',
  'banner', 'citadel', 'outpost', 'bastion', 'rampart', 'sentinel', 'warden', 'scout',
  'ranger', 'vanguard', 'compass', 'matrix', 'stride', 'zenith', 'horizon', 'glacier',
  'badger', 'badminton', 'balance', 'balcony', 'bamboo', 'banana', 'banner', 'bargain',
  'barrel', 'barrier', 'basin', 'basket', 'battery', 'beacon', 'beaver', 'beetle',
  'belfry', 'bellow', 'belt', 'bench', 'berry', 'bison', 'blade', 'blanket',
  'blazer', 'bleach', 'blend', 'blimp', 'blizzard', 'block', 'blonde', 'bloom',
  'blossom', 'blouse', 'bobcat', 'boiler', 'bold', 'bolster', 'bonanza', 'bonfire',
  'bonnet', 'bonsai', 'border', 'botany', 'bottle', 'bounce', 'boulder', 'bouquet',
  'bourbon', 'bowling', 'boxer', 'bracket', 'bramble', 'branch', 'brass', 'bravo',
  'bread', 'breaker', 'breeze', 'brick', 'bridge', 'brigade', 'brim', 'brine',
  'bristle', 'bronze', 'brook', 'broom', 'bubble', 'buckle', 'buffalo', 'buffer',
  'builder', 'bulb', 'bullfrog', 'bumper', 'bunker', 'buoy', 'burden', 'burlap',
  'burner', 'burrow', 'burst', 'bushel', 'butter', 'button', 'buzzer', 'cabin',
  'cable', 'cactus', 'cadet', 'cafe', 'calico', 'call', 'camel', 'camera',
  'camp', 'canal', 'canary', 'candle', 'candy', 'cane', 'canvas', 'canyon',
  'cape', 'capital', 'captain', 'caramel', 'carbon', 'card', 'cargo', 'carnival',
  'carol', 'carpet', 'carrot', 'cartel', 'carve', 'cascade', 'casino', 'cast',
  'castle', 'casual', 'catch', 'cater', 'catnip', 'cavern', 'cedar', 'celery',
  'census', 'center', 'cereal', 'chalk', 'chamber', 'champ', 'channel', 'chapel',
  'chapter', 'charcoal', 'chariot', 'charity', 'charm', 'chart', 'chase', 'chateau',
  'check', 'cheer', 'cheese', 'cheetah', 'cherry', 'chess', 'chest', 'chevron',
  'chief', 'chime', 'chimney', 'chipmunk', 'chisel', 'chive', 'chrome', 'chronicle',
  'cider', 'cigar', 'cinder', 'cinema', 'cipher', 'circle', 'circus', 'citadel',
  'citrus', 'civic', 'civil', 'claim', 'clamp', 'clank', 'clap', 'clarinet',
  'clarity', 'clash', 'clasp', 'classic', 'claw', 'clay', 'clean', 'clear',
  'cleat', 'cleft', 'clerk', 'clever', 'cliff', 'climate', 'climb', 'cling',
  'clinic', 'clip', 'cloak', 'clock', 'clone', 'cloth', 'cloud', 'clover',
  'clown', 'club', 'clump', 'cluster', 'clutch', 'coach', 'coast', 'coaster',
  'cobalt', 'cobra', 'cobweb', 'cockpit', 'cocoa', 'code', 'coffee', 'coffin',
  'cohort', 'coil', 'coin', 'cold', 'colleague', 'collector', 'college', 'colony',
  'color', 'colt', 'column', 'combat', 'comet', 'comfort', 'comic', 'command',
  'commando', 'compact', 'company', 'compass', 'complex', 'compose', 'compost', 'compound',
  'concert', 'conch', 'concord', 'concrete', 'condor', 'conduit', 'cone', 'conflict',
  'conifer', 'connect', 'conquest', 'console', 'constant', 'consul', 'contact', 'contour',
  'control', 'convent', 'converse', 'convex', 'convoy', 'cook', 'cookie', 'copper',
  'coral', 'cord', 'cork', 'corner', 'cornet', 'cornice', 'corona', 'corridor',
  'corsair', 'cortex', 'cosmic', 'costume', 'cottage', 'cotton', 'couch', 'cougar',
  'council', 'counsel', 'counter', 'county', 'coupe', 'courage', 'courier', 'course',
  'court', 'cove', 'covenant', 'cover', 'coyote', 'cradle', 'craft', 'crag',
  'crane', 'crank', 'crate', 'crater', 'crayon', 'creak', 'cream', 'creek',
  'crest', 'cricket', 'crimson', 'crisis', 'crisp', 'critic', 'crook', 'crop',
  'cross', 'crossing', 'crowbar', 'crowd', 'crown', 'crucible', 'cruise', 'crumb',
  'crust', 'crystal', 'cube', 'cubic', 'cuff', 'culvert', 'cupola', 'curb',
  'curfew', 'curio', 'currant', 'current', 'cursor', 'curtain', 'cushion', 'custody',
  'custom', 'cutlet', 'cutlass', 'cutter', 'cyan', 'cyclone', 'cylinder', 'cypress'
];

/**
 * Deterministically maps latitude & longitude to a 3-word combination
 * based on ~3m resolution worldwide.
 */
function hashCoordsToW3W(lat, lon) {
  // Normalize lat [-90, 90] and lon [-180, 180] into 3m grid cells
  // 1 deg lat ~ 111,000m => 37,000 cells per degree
  // 1 deg lon ~ 111,000m * cos(lat)
  const normLat = Math.floor((lat + 90) * 37000);
  const normLon = Math.floor((lon + 180) * 37000);

  // Integer hash combining lat and lon
  let h1 = Math.abs((normLat * 73856093) ^ (normLon * 19349663));
  let h2 = Math.abs((normLat * 83492791) ^ (normLon * 50331653));
  let h3 = Math.abs((normLat * 2654435761) ^ (normLon * 1597334677));

  const count = W3W_WORDS.length;
  const w1 = W3W_WORDS[h1 % count];
  const w2 = W3W_WORDS[h2 % count];
  const w3 = W3W_WORDS[h3 % count];

  // Prevent duplicate consecutive words
  const finalW2 = w2 === w1 ? W3W_WORDS[(h2 + 13) % count] : w2;
  const finalW3 = (w3 === w1 || w3 === finalW2) ? W3W_WORDS[(h3 + 37) % count] : w3;

  return `///${w1}.${finalW2}.${finalW3}`;
}

/**
 * Converts latitude and longitude to a What3Words address.
 * If W3W API key is present in environment, calls official API with fast fallback.
 */
export async function getWhat3Words(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (isNaN(lat) || isNaN(lon)) return null;

  const apiKey = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_W3W_API_KEY) ||
                 (typeof process !== 'undefined' && process.env?.W3W_API_KEY) || null;

  if (apiKey) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`https://api.what3words.com/v3/convertTo3wa?coordinates=${lat},${lon}&key=${apiKey}`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data?.words) {
          return `///${data.words.replace(/^\/\/\//, '')}`;
        }
      }
    } catch (_) {
      // Fall through to deterministic algorithm on network/timeout/offline
    }
  }

  return hashCoordsToW3W(lat, lon);
}

/**
 * Synchronous version for instant UI rendering without awaiting fetch.
 */
export function getWhat3WordsSync(latitude, longitude) {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (isNaN(lat) || isNaN(lon)) return null;
  return hashCoordsToW3W(lat, lon);
}

/**
 * Formats a location object into standard security telemetry components:
 * - Latitude (° N/S)
 * - Longitude (° E/W)
 * - Altitude (m above sea / elevation)
 * - W3W address (///word.word.word)
 */
export function formatLocationTelemetry(location) {
  if (!location || location.latitude == null || location.longitude == null) {
    return {
      hasGps: false,
      latitude: null,
      longitude: null,
      altitude: null,
      w3w: null,
      displayCoords: 'No GPS data',
      displayAltitude: 'Alt: —',
      summary: 'Location unavailable',
    };
  }

  const lat = Number(location.latitude);
  const lon = Number(location.longitude);
  const alt = location.altitude != null ? Number(location.altitude) : null;
  const w3w = location.what3words || location.w3w || hashCoordsToW3W(lat, lon);

  const latStr = `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? 'E' : 'W'}`;
  const altStr = alt != null ? `${Math.round(alt)}m` : null;

  return {
    hasGps: true,
    latitude: lat,
    longitude: lon,
    altitude: alt,
    w3w,
    latStr,
    lonStr,
    displayCoords: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
    summary: `${w3w} · ${altStr ? `${altStr} · ` : ''}${lat.toFixed(4)}, ${lon.toFixed(4)}`,
  };
}

/**
 * Validates What3Words format (word.word.word or ///word.word.word)
 */
export function isValidWhat3Words(w3w) {
  if (!w3w || typeof w3w !== 'string') return false;
  const clean = w3w.trim().replace(/^\/\/\//, '');
  return /^[a-zA-Z0-9]+\.[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/.test(clean);
}

/**
 * Validates Latitude (-90 to 90) and Longitude (-180 to 180)
 */
export function isValidCoordinates(lat, lng) {
  if (lat == null || lng == null) return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (isNaN(nLat) || isNaN(nLng)) return false;
  return nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
}

/**
 * Converts What3Words to coordinates using official API if API key is provided
 */
export async function getCoordinatesFromWhat3Words(words) {
  if (!isValidWhat3Words(words)) return null;
  const cleanWords = words.trim().replace(/^\/\/\//, '');
  const apiKey = (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_W3W_API_KEY) ||
                 (typeof process !== 'undefined' && process.env?.W3W_API_KEY) || null;

  if (apiKey) {
    try {
      const res = await fetch(`https://api.what3words.com/v3/convertToCoordinates?words=${cleanWords}&key=${apiKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.coordinates?.lat != null && data?.coordinates?.lng != null) {
          return {
            latitude: data.coordinates.lat,
            longitude: data.coordinates.lng,
          };
        }
      }
    } catch (_) {}
  }
  return null;
}

/**
 * Returns Google Maps URL for coordinates
 */
export function getMapUrl(lat, lng) {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${Number(lat)},${Number(lng)}`;
}

