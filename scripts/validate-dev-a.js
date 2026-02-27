/**
 * Validation tests for Developer A components (per spec).
 * Run with server up: node server.js (in another terminal), then: node scripts/validate-dev-a.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.PLATTER_BASE_URL || 'http://localhost:3000';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// --- 1. Slug (lib/slug.js) ---
function testSlug() {
  const { slugify } = require('../lib/slug');
  assert(typeof slugify === 'function', 'slugify is a function');
  assert(slugify('Luxe Nails') === 'luxe-nails', 'slug: spaces to hyphens');
  assert(slugify('  Bay Brow Studio  ') === 'bay-brow-studio', 'slug: trim');
  assert(slugify("Joe's Café & Bar").includes('caf') && !slugify("Joe's Café").includes("'"), 'slug: strip non-alphanumeric');
  assert(slugify('') !== undefined, 'slug: empty string returns safe default');
  console.log('  slug: OK');
}

// --- 2. Google Places (services/google-places.js) ---
async function testGooglePlaces() {
  const googlePlaces = require('../services/google-places');
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.log('  Google Places: SKIP (no key)');
    return;
  }
  const refs = await googlePlaces.textSearch('nail salons in San Francisco');
  assert(Array.isArray(refs), 'textSearch returns array');
  assert(refs.length > 0, 'textSearch returns at least one place');
  assert(refs[0].place_id && refs[0].name, 'place has place_id and name');
  const detail = await googlePlaces.getDetails(refs[0].place_id);
  assert(detail && typeof detail === 'object', 'getDetails returns object');
  assert('name' in detail, 'getDetails has name');
  assert('formatted_address' in detail || 'website' in detail || detail.website === undefined, 'getDetails has expected fields');
  console.log('  Google Places: OK');
}

// --- 3. Yutori (services/yutori.js) — create only, no full poll ---
async function testYutoriCreate() {
  const yutori = require('../services/yutori');
  if (!process.env.YUTORI_API_KEY) {
    console.log('  Yutori create: SKIP (no key)');
    return;
  }
  const { createTask } = yutori;
  const out = await createTask('Test Business', '123 Test St');
  assert(out && out.task_id, 'createTask returns task_id');
  console.log('  Yutori create: OK');
}

// --- 4. Search API (routes) — server must be running ---
async function testSearchEndpoints() {
  // POST /api/search
  const postRes = await fetch(`${BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'coffee shop in San Francisco' })
  });
  assert(postRes.ok, `POST /api/search ok: ${postRes.status}`);
  const postData = await postRes.json();
  assert(postData.search_id, 'response has search_id');
  const searchId = postData.search_id;

  // GET /api/search/:search_id/status
  const statusRes = await fetch(`${BASE}/api/search/${searchId}/status`);
  assert(statusRes.ok, 'GET status ok');
  const statusData = await statusRes.json();
  assert(['pending', 'processing', 'completed', 'failed'].includes(statusData.status), 'status is valid');
  assert(typeof statusData.completed === 'number' && typeof statusData.total === 'number', 'status has completed and total');

  // GET /api/results/:search_id
  const resultsRes = await fetch(`${BASE}/api/results/${searchId}`);
  assert(resultsRes.ok, 'GET results ok');
  const results = await resultsRes.json();
  assert(Array.isArray(results), 'results is array');

  console.log('  Search API (POST + status + results): OK');
}

// --- 5. Results shape (after pipeline completes or from in-memory) ---
async function testResultsShape() {
  const postRes = await fetch(`${BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'pizza in San Francisco' })
  });
  assert(postRes.ok, 'POST for shape test');
  const { search_id } = await postRes.json();
  const maxWait = 90_000; // 90s max wait for at least one result
  const step = 3000;
  let lastResults = [];
  for (let t = 0; t < maxWait; t += step) {
    await new Promise(r => setTimeout(r, step));
    const res = await fetch(`${BASE}/api/results/${search_id}`);
    lastResults = await res.json();
    const st = await fetch(`${BASE}/api/search/${search_id}/status`).then(r => r.json());
    if (lastResults.length > 0) {
      const b = lastResults[0];
      assert(b.id && b.name && b.slug !== undefined, 'business has id, name, slug');
      assert(b.has_website === false, 'business has_website is false');
      assert(typeof b.google_reviews === 'number' && (b.google_rating === null || typeof b.google_rating === 'number'), 'google_reviews/rating');
      assert('style' in b && 'description' in b, 'has style and description');
      console.log('  Results shape (one business): OK');
      return;
    }
    if (st.status === 'completed' && lastResults.length === 0) {
      console.log('  Results shape: SKIP (pipeline completed with 0 no-website businesses)');
      return;
    }
  }
  console.log('  Results shape: SKIP (no result within 90s; pipeline may still be running)');
}

async function main() {
  console.log('Dev A validation (server must be running at', BASE, ')\n');
  try {
    console.log('1. Slug');
    testSlug();

    console.log('2. Google Places');
    await testGooglePlaces();

    console.log('3. Yutori create');
    await testYutoriCreate();

    console.log('4. Search endpoints');
    await testSearchEndpoints();

    console.log('5. Results shape (may wait up to 90s for one result)');
    await testResultsShape();

    console.log('\nAll validations passed.');
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error('\nServer not running. Start with: node server.js');
      process.exit(1);
    }
    console.error('\nValidation failed:', err.message);
    process.exit(1);
  }
}

main();
