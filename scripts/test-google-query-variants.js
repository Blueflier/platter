/**
 * Test whether "x niche in y city within z miles" (literal or via API location+radius)
 * returns more or different results than "x niche in y city".
 *
 * Compares:
 *   A) query only: "niche in city"
 *   B) query with literal "within Z miles": "niche in city within 10 miles"
 *   C) query + API location + radius: same as A but with locationBias and radiusMeters
 *
 * Usage: node scripts/test-google-query-variants.js
 * Requires: GOOGLE_PLACES_API_KEY in .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const googlePlaces = require('../services/google-places');

const MILES_TO_METERS = 1609.34;
const RADIUS_MILES = 10;
const RADIUS_METERS = Math.round(RADIUS_MILES * MILES_TO_METERS);

// City center lat,lng for location bias (approximate)
const CITY_CENTERS = {
  'San Francisco': { lat: 37.7749, lng: -122.4194 },
  'Oakland': { lat: 37.8044, lng: -122.2712 },
  'Berkeley': { lat: 37.8715, lng: -122.2730 },
  'San Jose': { lat: 37.3382, lng: -121.8863 },
};

const TEST_CASES = [
  { niche: 'nail salons', city: 'Oakland' },
  { niche: 'gun shop', city: 'San Francisco' },
  { niche: 'café', city: 'Berkeley' },
  { niche: 'plumber', city: 'Oakland' },
  { niche: 'bakery', city: 'San Francisco' },
];

async function runVariant(label, query, opts = {}) {
  const results = await googlePlaces.textSearch(query, opts);
  return { label, query: query + (opts.radiusMeters ? ` [+${RADIUS_MILES}mi radius]` : ''), count: results.length, names: results.slice(0, 3).map(r => r.name) };
}

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('Need GOOGLE_PLACES_API_KEY in .env');
    process.exit(1);
  }

  console.log('Google Places: comparing query variants (niche in city vs within Z miles)\n');
  console.log('Variants: A = "niche in city", B = "niche in city within 10 miles", C = A + API location+radius\n');

  for (const { niche, city } of TEST_CASES) {
    const center = CITY_CENTERS[city];
    const queryBase = `${niche} in ${city}`;
    const queryWithMiles = `${niche} in ${city} within ${RADIUS_MILES} miles`;

    const [a, b, c] = await Promise.all([
      runVariant('A', queryBase),
      runVariant('B', queryWithMiles),
      center
        ? runVariant('C', queryBase, { locationBias: center, radiusMeters: RADIUS_METERS })
        : Promise.resolve({ label: 'C', query: queryBase + ' [no center]', count: 0, names: [] }),
    ]);

    console.log(`--- ${queryBase} ---`);
    console.log(`  A (query only):     ${a.count} results  ${a.names.join(', ')}${a.names.length < a.count ? '...' : ''}`);
    console.log(`  B (with "within ${RADIUS_MILES} mi"): ${b.count} results  ${b.names.join(', ')}${b.names.length < b.count ? '...' : ''}`);
    console.log(`  C (API location+radius): ${c.count} results  ${c.names.join(', ')}${c.names.length < c.count ? '...' : ''}`);
    const best = [a, b, c].sort((x, y) => y.count - x.count)[0];
    if (best.count > Math.min(a.count, b.count, c.count)) {
      console.log(`  → Most results: ${best.label} (${best.count})`);
    }
    console.log('');
  }

  console.log('Done. B = literal "within Z miles" in query; C = same query as A with location + radius in API.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
