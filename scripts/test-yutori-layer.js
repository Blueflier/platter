/**
 * Test Yutori layer like production: Google returns only NO-WEBSITE places, then we send one to Yutori.
 * Flow: Google textSearch + getDetails → filter to no website → use first such place → Yutori create + poll.
 *
 * Usage: node scripts/test-yutori-layer.js
 *
 * Requires: GOOGLE_PLACES_API_KEY and YUTORI_API_KEY in .env
 * Yutori task may take up to 10 min to complete.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const googlePlaces = require('../services/google-places');
const yutori = require('../services/yutori');

// Same as production: we only use places without a website
const GOOGLE_QUERY = 'nail salons in San Francisco';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY not set.');
    process.exit(1);
  }
  if (!process.env.YUTORI_API_KEY) {
    console.error('YUTORI_API_KEY not set.');
    process.exit(1);
  }

  console.log('=== Yutori test (production-like: Google no-website only) ===\n');

  console.log('1. Google layer — get first place WITH NO WEBSITE (like production)');
  console.log('   Query:', GOOGLE_QUERY);
  const refs = await googlePlaces.textSearch(GOOGLE_QUERY);
  assert(refs.length > 0, 'Google returned no results');
  let businessName = null;
  let address = null;
  for (const ref of refs) {
    const detail = await googlePlaces.getDetails(ref.place_id);
    if (!detail || !detail.name) continue;
    if (detail.website) continue; // skip — has website (production filter)
    businessName = detail.name || ref.name || 'Unknown';
    address = detail.formatted_address || '';
    console.log('   Found no-website place:', businessName);
    console.log('   Address:', address);
    break;
  }
  if (!businessName || !address) {
    console.error('   No business without a website found in results. Try a different query or area.');
    process.exit(1);
  }
  console.log('');

  console.log('2. Yutori — research that real place');
  const prompt = yutori.buildQuery(businessName, address);
  console.log('   Prompt sent to Yutori:');
  console.log('   ', prompt);
  console.log('');
  const { task_id } = await yutori.createTask(businessName, address);
  assert(task_id, 'task_id');
  console.log('   task_id:', task_id);
  console.log('   Polling (up to 10 min)...');
  const result = await yutori.pollTask(task_id);
  console.log('   Done.\n');

  console.log('3. Parsed output (plain text, correct fields for pipeline):');
  assert(result && typeof result === 'object', 'result is object');
  assert('email' in result && 'style' in result && 'description' in result, 'has email, style, description');
  console.log('   email:          ', result.email === null ? '(null)' : result.email);
  console.log('   style:         ', result.style === null ? '(null)' : result.style);
  console.log('   description:   ', result.description ? result.description.slice(0, 120) + (result.description.length > 120 ? '...' : '') : '(empty)');
  console.log('   phone:             ', result.phone === null ? '(null)' : result.phone, '(supplement if Google has none)');
  console.log('   business_hours:    ', result.business_hours === null ? '(null)' : result.business_hours?.slice(0, 80) + (result.business_hours?.length > 80 ? '...' : ''));
  console.log('   social_media_links:', (result.social_media_links && result.social_media_links.length) ? result.social_media_links.length + ' link(s)' : '(none)');
  if (result.social_media_links?.length) result.social_media_links.slice(0, 3).forEach(u => console.log('      ', u));
  console.log('');

  if (result.rawText) {
    console.log('4. Raw API result (first 600 chars):');
    console.log('   ' + result.rawText.slice(0, 600).replace(/\n/g, '\n   '));
    if (result.rawText.length > 600) console.log('   ...');
    console.log('');
  }

  console.log('=== Summary ===');
  console.log('Google (no-website only) → Yutori research completed.');
  console.log('Parsed output is plain text (HTML stripped) for businesses.json and downstream Fastino.');
}

main().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
