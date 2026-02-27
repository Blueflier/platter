/**
 * Validate textSearchAllPages: we get multiple pages (up to 60) and no duplicate place_ids.
 *
 * Usage: node scripts/validate-google-pagination.js
 * Requires: GOOGLE_PLACES_API_KEY in .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const googlePlaces = require('../services/google-places');

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('Need GOOGLE_PLACES_API_KEY in .env');
    process.exit(1);
  }

  const query = 'nail salons in Oakland within 20 miles';
  console.log('Validate Google textSearchAllPages (pagination)\n');
  console.log('Query:', query);
  console.log('Single page (textSearch):');
  const singlePage = await googlePlaces.textSearch(query);
  console.log('  count:', singlePage.length);

  console.log('\nUp to 60 (textSearchAllPages):');
  const allPages = await googlePlaces.textSearchAllPages(query, {}, 60);
  console.log('  count:', allPages.length);

  const ids = allPages.map(r => r.place_id);
  const uniqueIds = new Set(ids);
  const noDupes = ids.length === uniqueIds.size;

  if (allPages.length < singlePage.length) {
    console.error('\nFAIL: allPages count should be >= single page count.');
    process.exit(1);
  }
  if (!noDupes) {
    console.error('\nFAIL: duplicate place_ids in results.');
    process.exit(1);
  }
  if (allPages.length > 60) {
    console.error('\nFAIL: count should be <= 60.');
    process.exit(1);
  }

  console.log('  no duplicate place_ids:', noDupes ? '✓' : '✗');
  console.log('\n--- Pagination validation passed. ---');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
