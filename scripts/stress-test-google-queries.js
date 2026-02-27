/**
 * Stress-test Google Places textSearch with many query shapes.
 * Ensures we understand what inputs give good results and what to validate.
 * Run: node scripts/stress-test-google-queries.js
 * Requires: GOOGLE_PLACES_API_KEY in .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const googlePlaces = require('../services/google-places');

const QUERIES = [
  // Good: category + location
  { q: 'nail salons in San Francisco', expect: 'good' },
  { q: 'nail salons in SF', expect: 'good' },
  { q: 'coffee shops in Oakland', expect: 'good' },
  { q: 'restaurants in Mission District San Francisco', expect: 'good' },
  { q: 'plumbers in San Jose', expect: 'good' },
  { q: 'hair salons near Berkeley', expect: 'good' },
  { q: 'pizza in San Francisco', expect: 'good' },
  { q: 'fishing shops in San Francisco', expect: 'good' },
  // Missing or vague location
  { q: 'nail salons', expect: 'weak' },
  { q: 'coffee shops', expect: 'weak' },
  { q: 'restaurants', expect: 'weak' },
  { q: 'plumbers', expect: 'weak' },
  // Very short / generic
  { q: 'food', expect: 'weak' },
  { q: 'shop', expect: 'weak' },
  // Edge cases
  { q: '  nail salons in San Francisco  ', expect: 'good' },
  { q: 'NAIL SALONS IN SAN FRANCISCO', expect: 'good' },
  { q: 'nail salons in Los Angeles', expect: 'good' },
  { q: 'auto repair in San Francisco', expect: 'good' },
  // Location phrases: Bay Area, etc.
  { q: 'nail salons in Bay Area', expect: 'good' },
  { q: 'coffee shops Bay Area', expect: 'good' },
  { q: 'restaurants in the Bay Area', expect: 'good' },
  { q: 'plumbers Bay Area California', expect: 'good' },
];

// Same mapping as routes/search.js — required for pipeline downstream
function mapDetailToPlace(ref, detail) {
  return {
    name: detail.name || ref.name || 'Unknown',
    address: detail.formatted_address || '',
    phone: detail.formatted_phone_number ?? null,
    rating: detail.rating != null ? detail.rating : null,
    user_ratings_total: detail.user_ratings_total != null ? detail.user_ratings_total : 0
  };
}

function assertPlaceShape(place) {
  if (typeof place.name !== 'string') throw new Error('place.name must be string');
  if (typeof place.address !== 'string') throw new Error('place.address must be string');
  if (place.phone !== null && typeof place.phone !== 'string') throw new Error('place.phone must be null or string');
  if (place.rating !== null && (typeof place.rating !== 'number' || place.rating < 0)) throw new Error('place.rating must be null or non-negative number');
  if (typeof place.user_ratings_total !== 'number' || place.user_ratings_total < 0) throw new Error('place.user_ratings_total must be non-negative number');
}

async function runOne({ q, expect: expected }) {
  const result = { query: q, expected, status: null, count: 0, shapeOk: null, error: null };
  try {
    const list = await googlePlaces.textSearch(q);
    result.status = 'ok';
    result.count = list.length;
    if (list.length > 0) {
      const ref = list[0];
      if (!ref.place_id || ref.name === undefined) throw new Error('textSearch result missing place_id or name');
      const detail = await googlePlaces.getDetails(ref.place_id);
      if (!detail || typeof detail !== 'object') throw new Error('getDetails returned empty or non-object');
      const place = mapDetailToPlace(ref, detail);
      assertPlaceShape(place);
      result.shapeOk = true;
    }
  } catch (err) {
    result.status = 'error';
    result.error = err.message.slice(0, 100);
  }
  return result;
}

function summarize(results) {
  const ok = results.filter(r => r.status === 'ok');
  const good = results.filter(r => r.expected === 'good');
  const goodOk = results.filter(r => r.expected === 'good' && r.status === 'ok' && r.count > 0);
  const weakOk = results.filter(r => r.expected === 'weak' && r.status === 'ok');
  return {
    total: results.length,
    ok: ok.length,
    errors: results.length - ok.length,
    goodQueriesWithResults: goodOk.length,
    goodQueriesTotal: good.length,
    weakQueriesWithResults: weakOk.length,
  };
}

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY not set. Add to .env and retry.');
    process.exit(1);
  }

  console.log('Stress-testing Google Places textSearch...\n');
  const results = [];
  for (const item of QUERIES) {
    const r = await runOne(item);
    results.push(r);
    const icon = r.status === 'ok' ? (r.count > 0 ? (r.shapeOk ? '✓' : '?') : '○') : '✗';
    const shape = r.shapeOk !== undefined ? (r.shapeOk ? ' shape✓' : ' shape✗') : '';
    console.log(`${icon} "${r.query}" → ${r.status} (${r.count} results)${shape}${r.error ? ' ' + r.error : ''}`);
  }

  const s = summarize(results);
  const shapeOkCount = results.filter(r => r.shapeOk === true).length;
  const withResults = results.filter(r => r.count > 0).length;
  console.log('\n--- Summary ---');
  console.log(`Total: ${s.total} | OK: ${s.ok} | Errors: ${s.errors}`);
  console.log(`Result sets with correct shape (first result validated): ${shapeOkCount}/${withResults}`);
  console.log(`"Good" queries with results: ${s.goodQueriesWithResults}/${s.goodQueriesTotal}`);
  console.log(`"Weak" queries with results: ${s.weakQueriesWithResults}`);
  if (withResults > 0 && shapeOkCount !== withResults) process.exit(1);
  if (s.errors > 0) process.exit(1);
  console.log('\nAll result sets have correct shapes and required info for pipeline.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
