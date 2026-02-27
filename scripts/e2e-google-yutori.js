/**
 * Full E2E: Google → Yutori → businesses.json.
 * Runs POST /api/search, waits for pipeline to complete, then validates
 * that at least one business has the expected shape and Yutori data (no HTML).
 *
 * Usage: Start server (node server.js), then:
 *   node scripts/e2e-google-yutori.js
 *
 * Requires: GOOGLE_PLACES_API_KEY, YUTORI_API_KEY in .env
 * Timeout: up to ~15 min (pipeline + Yutori can be slow).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.PLATTER_BASE_URL || 'http://localhost:3000';
const { readData } = require('../lib/store');

const QUERY = 'nail salons in San Francisco';
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 15 * 60 * 1000; // 15 min

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hasHtml(s) {
  if (s == null || typeof s !== 'string') return false;
  return /<[a-z][\s\S]*>/i.test(s) || /&[a-z]+;|&#\d+;/i.test(s);
}

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY || !process.env.YUTORI_API_KEY) {
    console.error('Need GOOGLE_PLACES_API_KEY and YUTORI_API_KEY in .env');
    process.exit(1);
  }

  console.log('E2E: Google → Yutori → businesses.json\n');
  console.log('1. POST /api/search', { query: QUERY });
  const postRes = await fetch(`${BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY })
  });
  assert(postRes.ok, `POST failed: ${postRes.status}`);
  const { search_id } = await postRes.json();
  assert(search_id, 'missing search_id');
  console.log('   search_id:', search_id, '\n');

  console.log('2. Poll status until completed (or timeout ', MAX_WAIT_MS / 60000, 'min)');
  const deadline = Date.now() + MAX_WAIT_MS;
  let status;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${BASE}/api/search/${search_id}/status`);
    assert(res.ok, 'status failed');
    const data = await res.json();
    status = data.status;
    console.log('   ', data.completed, '/', data.total, '—', status);
    if (data.status === 'completed') break;
    if (data.status === 'failed') {
      console.error('   Pipeline failed.');
      process.exit(1);
    }
  }
  assert(status === 'completed', 'Pipeline did not complete within timeout');

  console.log('\n3. GET /api/results/:search_id');
  const resultsRes = await fetch(`${BASE}/api/results/${search_id}`);
  assert(resultsRes.ok, 'results failed');
  const results = await resultsRes.json();
  assert(Array.isArray(results), 'results not array');
  assert(results.length > 0, 'no businesses returned');
  console.log('   Businesses:', results.length);

  console.log('\n4. Validate businesses.json and result shape');
  const fromFile = await readData('businesses.json');
  assert(Array.isArray(fromFile), 'businesses.json must be array');
  const fromPipeline = fromFile.filter(b => results.some(r => r.id === b.id));
  assert(fromPipeline.length > 0, 'at least one business from this search must be in businesses.json');

  const required = ['id', 'name', 'address', 'phone', 'email', 'has_website', 'google_reviews', 'google_rating', 'style', 'description', 'slug', 'status'];
  for (const biz of fromPipeline) {
    for (const key of required) {
      assert(key in biz, `missing field: ${key}`);
    }
    assert(biz.has_website === false, 'has_website must be false');
    assert(typeof biz.google_reviews === 'number', 'google_reviews number');
    assert(!hasHtml(biz.description), 'description must be plain text (no HTML)');
    assert(!hasHtml(biz.style || ''), 'style must be plain text (no HTML)');
    assert(Array.isArray(biz.social_media_links ?? []), 'social_media_links must be array');
  }
  console.log('   Shape and no-HTML checks passed for', fromPipeline.length, 'business(es).');

  const withHours = fromPipeline.filter(b => b.business_hours);
  const withSocial = fromPipeline.filter(b => b.social_media_links?.length > 0);
  console.log('   With business_hours:', withHours.length);
  console.log('   With social_media_links:', withSocial.length);

  console.log('\n--- E2E passed: Google → Yutori → businesses.json is valid. ---');
}

main().catch(err => {
  if (err.cause?.code === 'ECONNREFUSED') {
    console.error('Server not running. Start with: node server.js');
  } else {
    console.error('E2E failed:', err.message);
  }
  process.exit(1);
});
