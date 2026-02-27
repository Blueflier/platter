// Poly Haven API: fetch free GLTF 3D models for Three.js scenes
// API docs: https://polyhaven.com/our-api
// CDN host: dl.polyhaven.org (CORS-enabled, no auth needed)

const API_BASE = 'https://api.polyhaven.com';
const USER_AGENT = 'Platter-v1';

// Cached asset list (fetched once, reused across calls)
let assetsCache = null;
let assetsCacheTime = 0;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// Business-type keyword → Poly Haven search terms (ordered by relevance).
// Built from actual Poly Haven catalog analysis.
const BUSINESS_KEYWORD_MAP = {
  // Food & drink
  coffee:     ['coffee', 'cup', 'mug', 'tea'],
  cafe:       ['coffee', 'cup', 'tea', 'croissant', 'cake'],
  bakery:     ['cake', 'croissant', 'bread', 'food', 'cutting_board'],
  restaurant: ['table', 'chair', 'plate', 'bowl', 'pot'],
  pizza:      ['food', 'plate', 'table', 'stove'],
  taco:       ['food', 'pot', 'bowl', 'plate'],
  bar:        ['wine', 'goblet', 'bottle', 'stool', 'barrel'],
  brewery:    ['barrel', 'bottle', 'wine', 'goblet'],
  juice:      ['food', 'fruit', 'apple', 'lemon', 'bottle'],
  ice_cream:  ['food', 'bowl', 'cup', 'fruit'],
  diner:      ['stool', 'table', 'plate', 'food'],
  sushi:      ['bowl', 'plate', 'tea', 'table'],

  // Personal care
  salon:      ['chair', 'mirror', 'lamp', 'vase'],
  barber:     ['barber', 'chair', 'mirror', 'lamp'],
  nail:       ['vase', 'flower', 'lamp', 'chair'],
  spa:        ['candle', 'vase', 'flower', 'lantern', 'plant'],
  grooming:   ['chair', 'mirror', 'lamp', 'plant'],
  beauty:     ['mirror', 'vase', 'flower', 'lamp', 'chair'],
  hair:       ['chair', 'mirror', 'lamp', 'plant'],
  massage:    ['candle', 'plant', 'lantern', 'vase'],

  // Fitness & health
  gym:        ['dumbbell', 'bench', 'chair', 'stool'],
  yoga:       ['plant', 'candle', 'lantern', 'vase'],
  dentist:    ['chair', 'lamp', 'stool', 'clock'],
  doctor:     ['chair', 'lamp', 'clock', 'plant'],
  clinic:     ['chair', 'lamp', 'plant', 'clock'],
  pharmacy:   ['bottle', 'shelf', 'cabinet', 'plant'],
  veterinary: ['plant', 'chair', 'lamp', 'bowl'],

  // Retail
  shop:       ['shelf', 'cabinet', 'register', 'lamp'],
  store:      ['shelf', 'cabinet', 'register', 'lamp'],
  boutique:   ['mirror', 'lamp', 'vase', 'shelf'],
  jewelry:    ['chandelier', 'mirror', 'lamp', 'vase'],
  flower:     ['flower', 'plant', 'vase', 'pot'],
  florist:    ['flower', 'plant', 'vase', 'pot'],
  pet:        ['bowl', 'plant', 'basket', 'shelf'],
  bookstore:  ['book', 'shelf', 'lamp', 'chair'],
  gift:       ['vase', 'candle', 'frame', 'lamp'],

  // Auto & trade
  auto:       ['barrel', 'tool', 'wrench', 'lamp'],
  car:        ['barrel', 'tool', 'wrench', 'lamp'],
  mechanic:   ['tool', 'wrench', 'barrel', 'lamp'],
  plumber:    ['wrench', 'tool', 'pipe', 'barrel'],
  electric:   ['lamp', 'lightbulb', 'tool', 'drill'],
  cleaning:   ['bottle', 'cleaner', 'mop', 'bucket'],
  laundry:    ['basket', 'shelf', 'bottle', 'plant'],

  // Home
  furniture:  ['chair', 'table', 'sofa', 'shelf'],
  interior:   ['lamp', 'vase', 'mirror', 'chandelier'],
  garden:     ['plant', 'flower', 'sprinkler', 'pot'],
  landscaping:['tree', 'plant', 'rock', 'flower'],

  // Professional
  office:     ['chair', 'desk', 'lamp', 'book'],
  law:        ['book', 'desk', 'lamp', 'frame'],
  accounting: ['book', 'desk', 'lamp', 'clock'],
  photography:['camera', 'lamp', 'frame', 'chair'],
  music:      ['ukulele', 'boombox', 'chair', 'lamp'],
  tattoo:     ['chair', 'lamp', 'frame', 'mirror'],
  gun:        ['barrel', 'tool', 'lamp', 'cabinet'],

  // Hospitality
  hotel:      ['chandelier', 'bed', 'lamp', 'vase'],
  lodging:    ['bed', 'lamp', 'chair', 'vase'],

  // Animals
  dog:        ['bowl', 'basket', 'plant', 'chair'],
  cat:        ['basket', 'plant', 'bowl', 'chair'],
  vet:        ['plant', 'chair', 'lamp', 'bowl'],

  // Misc
  taqueria:   ['food', 'pot', 'bowl', 'plate', 'barrel'],
  dry_cleaning: ['shelf', 'cabinet', 'lamp', 'clock'],
  repair:     ['tool', 'wrench', 'lamp', 'shelf'],
  print:      ['frame', 'book', 'shelf', 'lamp'],
  school:     ['desk', 'chair', 'book', 'lamp'],
  church:     ['chandelier', 'candle', 'lantern', 'book'],
  studio:     ['camera', 'lamp', 'frame', 'chair'],
  fitness:    ['chair', 'stool', 'lamp', 'clock'],
  wellness:   ['candle', 'plant', 'vase', 'lantern'],
  smoke:      ['barrel', 'lamp', 'cabinet', 'chair'],
};

// Curated visually-appealing fallbacks (always available in Poly Haven catalog)
const FALLBACK_ASSETS = [
  'CoffeeCart_01', 'ArmChair_01', 'Chandelier_01', 'Lantern_01',
  'antique_ceramic_vase_01', 'Rockingchair_01', 'Ukulele_01',
  'potted_plant_01', 'CoffeeTable_01', 'tea_set_01',
  'mantel_clock_01', 'brass_candleholders', 'ornate_mirror_01',
  'vintage_cabinet_01', 'desk_lamp_arm_01', 'ceramic_vase_01',
  'wooden_display_shelves_01', 'alarm_clock_01', 'dartboard',
];

async function fetchAssets() {
  if (assetsCache && Date.now() - assetsCacheTime < CACHE_TTL_MS) {
    return assetsCache;
  }
  const res = await fetch(`${API_BASE}/assets?t=models`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) throw new Error(`Poly Haven assets fetch failed: ${res.status}`);
  assetsCache = await res.json();
  assetsCacheTime = Date.now();
  return assetsCache;
}

// Score an asset against a single keyword. Uses word-boundary matching
// to avoid false positives (e.g. "pet" matching "carpet").
function scoreAsset(asset, id, keyword) {
  const parts = [
    id,
    asset.name || '',
    ...(asset.categories || []),
    ...(asset.tags || []),
  ].join(' ').toLowerCase();

  const kw = keyword.toLowerCase();
  // Word-boundary match: check if keyword appears as a whole word
  const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  if (re.test(parts)) return 2;
  // Substring fallback (weaker)
  if (parts.includes(kw)) return 1;
  return 0;
}

async function getGltfUrl(assetId) {
  const filesRes = await fetch(`${API_BASE}/files/${assetId}`, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!filesRes.ok) return null;
  const files = await filesRes.json();
  return files?.gltf?.['1k']?.gltf?.url || files?.gltf?.['2k']?.gltf?.url || null;
}

// Try to find a model matching a single keyword. Returns { asset_id, url } or null.
async function searchByKeyword(assets, keyword) {
  let best = null;
  let bestScore = 0;
  for (const [id, asset] of Object.entries(assets)) {
    const s = scoreAsset(asset, id, keyword);
    if (s > bestScore) {
      bestScore = s;
      best = id;
    }
  }
  if (!best) return null;
  const url = await getGltfUrl(best);
  if (!url) return null;
  return { asset_id: best, url, format: 'gltf' };
}

// Expand a yutori keyword into a list of search terms using the business map.
// e.g. "coffee_cup" → try "coffee_cup" first, then mapped "coffee" terms, then "cup" terms
function expandKeywords(keyword) {
  const terms = [keyword]; // always try the original first
  const normalized = keyword.replace(/_/g, ' ').toLowerCase().trim();

  // Try the full normalized phrase as a map key (e.g. "ice_cream" → "ice cream" → map key "ice_cream")
  const joinedKey = normalized.replace(/\s+/g, '_');
  if (BUSINESS_KEYWORD_MAP[joinedKey]) {
    for (const mapped of BUSINESS_KEYWORD_MAP[joinedKey]) {
      if (!terms.includes(mapped)) terms.push(mapped);
    }
  }

  // Then try each individual word
  const words = normalized.split(/\s+/);
  for (const word of words) {
    if (BUSINESS_KEYWORD_MAP[word]) {
      for (const mapped of BUSINESS_KEYWORD_MAP[word]) {
        if (!terms.includes(mapped)) terms.push(mapped);
      }
    }
  }
  return terms;
}

// Main entry point. Tries multiple keywords until it finds a model.
// Always returns a result — falls back to a random curated asset.
async function findModel(keyword) {
  try {
    const assets = await fetchAssets();

    // Build keyword search list
    const terms = keyword ? expandKeywords(keyword) : [];

    // Try each term in order
    for (const term of terms) {
      const result = await searchByKeyword(assets, term);
      if (result) return result;
    }

    // All keyword attempts failed — pick a random curated fallback
    const shuffled = [...FALLBACK_ASSETS].sort(() => Math.random() - 0.5);
    for (const fallbackId of shuffled) {
      if (assets[fallbackId]) {
        const url = await getGltfUrl(fallbackId);
        if (url) return { asset_id: fallbackId, url, format: 'gltf', fallback: true };
      }
    }

    return null;
  } catch (err) {
    console.error('Poly Haven lookup error:', err.message);
    return null;
  }
}

module.exports = { findModel };
