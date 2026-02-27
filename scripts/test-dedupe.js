/**
 * Test dedupe: (1) unit test lib/dedupe, (2) integration test — run search
 * with a query that includes existing businesses and assert no duplicate
 * name+address is added to businesses.json.
 *
 * Usage: Start server (node server.js), then:
 *   node scripts/test-dedupe.js
 *
 * Requires: GOOGLE_PLACES_API_KEY in .env (for integration part)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const BASE = process.env.PLATTER_BASE_URL || 'http://localhost:3000';
const { normalizeForDedup, normalizeAddress, alreadyExists } = require('../lib/dedupe');
const { readData } = require('../lib/store');

const QUERY = 'nail salons in San Francisco'; // already have Dynasty Nail from this
const POLL_INTERVAL_MS = 5000;
const MAX_WAIT_MS = 5 * 60 * 1000; // 5 min

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function unitTests() {
  console.log('1. Unit tests (lib/dedupe)\n');

  assert(normalizeForDedup('  Dynasty  Nail  ') === 'dynasty nail', 'normalize trim + collapse');
  assert(normalizeForDedup('107 Stevenson St, San Francisco, CA 94105, USA') === '107 stevenson st, san francisco, ca 94105', 'normalize address (strip , USA)');
  assert(normalizeForDedup(null) === '', 'null -> empty');
  assert(normalizeForDedup('') === '', 'empty -> empty');

  const list = [
    { name: 'Dynasty Nail', address: '107 Stevenson St, San Francisco, CA 94105, USA' }
  ];
  assert(alreadyExists(list, 'Dynasty Nail', '107 Stevenson St, San Francisco, CA 94105, USA'), 'same name+address exists');
  assert(alreadyExists(list, 'dynasty nail', '107 stevenson st, san francisco, ca 94105, usa'), 'normalized match exists');
  assert(!alreadyExists(list, 'Other Nail', '107 Stevenson St, San Francisco, CA 94105, USA'), 'different name');
  assert(!alreadyExists(list, 'Dynasty Nail', '999 Other St'), 'different address');
  assert(!alreadyExists([], 'Dynasty Nail', '107 Stevenson St'), 'empty list');

  console.log('   normalizeForDedup + alreadyExists: OK\n');
}

async function integrationTest() {
  console.log('2. Integration test (POST search, assert no new duplicates)\n');

  const before = await readData('businesses.json');
  const beforeCounts = new Map();
  for (const b of before) {
    const key = `${normalizeForDedup(b.name)}|${normalizeAddress(b.address)}`;
    beforeCounts.set(key, (beforeCounts.get(key) || 0) + 1);
  }

  console.log('   POST /api/search', { query: QUERY });
  const postRes = await fetch(`${BASE}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: QUERY })
  });
  assert(postRes.ok, `POST failed: ${postRes.status}`);
  const { search_id } = await postRes.json();
  assert(search_id, 'missing search_id');
  console.log('   search_id:', search_id);

  console.log('   Poll status until completed...');
  const deadline = Date.now() + MAX_WAIT_MS;
  let status;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const res = await fetch(`${BASE}/api/search/${search_id}/status`);
    assert(res.ok, 'status failed');
    const data = await res.json();
    status = data.status;
    console.log('   ', data.completed, '/', data.total, '—', status);
    if (data.status === 'completed') break;
    if (data.status === 'failed') throw new Error('Pipeline failed');
  }
  assert(status === 'completed', 'Pipeline did not complete within timeout');

  const after = await readData('businesses.json');

  // For every (name, address) that existed before, count must not increase (no duplicates added)
  for (const [key, beforeCount] of beforeCounts) {
    const afterCount = after.filter(
      (x) => `${normalizeForDedup(x.name)}|${normalizeAddress(x.address)}` === key
    ).length;
    assert(afterCount <= beforeCount, `duplicate added for key ${key}: before ${beforeCount}, after ${afterCount}`);
  }

  console.log('   No new duplicates in businesses.json: OK\n');
}

async function main() {
  await unitTests();
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.log('2. Integration test: skipped (no GOOGLE_PLACES_API_KEY)\n');
  } else {
    await integrationTest();
  }
  console.log('--- Dedupe test passed. ---');
}

main().catch((err) => {
  if (err.cause?.code === 'ECONNREFUSED') {
    console.error('Server not running. Start with: node server.js');
  } else {
    console.error('Dedupe test failed:', err.message);
  }
  process.exit(1);
});
