/**
 * Validate that the default "within 20 miles" appends correctly and yields
 * at least as many Google Places results as the raw query (matches routes/search.js logic).
 *
 * Usage: node scripts/validate-google-default-radius.js
 * Requires: GOOGLE_PLACES_API_KEY in .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const googlePlaces = require('../services/google-places');

// Same logic as routes/search.js
function buildGoogleQuery(query) {
  return / within \d+\s*miles?/i.test(query) ? query : `${query} within 20 miles`;
}

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('Need GOOGLE_PLACES_API_KEY in .env');
    process.exit(1);
  }

  const tests = [
    { query: 'gun shop in San Francisco', expectMoreOrEqual: true },
    { query: 'nail salons in Oakland', expectMoreOrEqual: false },
    { query: 'tacos in San Jose', expectMoreOrEqual: false },
  ];

  console.log('Validate default "within 20 miles" (search route logic)\n');

  let failed = 0;
  for (const { query, expectMoreOrEqual } of tests) {
    const googleQuery = buildGoogleQuery(query);
    const rawCount = (await googlePlaces.textSearch(query)).length;
    const withRadiusCount = (await googlePlaces.textSearch(googleQuery)).length;

    const ok = withRadiusCount >= rawCount;
    if (!ok) failed++;
    console.log(`  "${query}"`);
    console.log(`    raw: ${rawCount}  →  with "within 20 miles": ${withRadiusCount}  ${ok ? '✓' : '✗ FAIL'}`);
  }

  console.log('');
  if (failed > 0) {
    console.error('Validation failed: with-radius count should be >= raw count.');
    process.exit(1);
  }
  console.log('--- Default radius validation passed. ---');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
