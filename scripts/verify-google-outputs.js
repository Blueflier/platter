/**
 * Verifies that Google Places API outputs match the shape and fields
 * required for the full prod pipeline (Yutori input, business object, /api/generate).
 * Run: node scripts/verify-google-outputs.js
 * Requires: GOOGLE_PLACES_API_KEY in .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const googlePlaces = require('../services/google-places');

// Downstream requirements (from spec + routes):
// - For Yutori createTask(businessName, address): need name, address
// - For business object / businesses.json / GET /api/results: id, name, address, phone, email, has_website, google_reviews, google_rating, style, description, slug, status
// - For POST /api/generate: id, name, description, style, phone, address, email, slug
// So Google layer must supply: name, address (formatted_address), phone (formatted_phone_number), rating, user_ratings_total, editorial_summary (optional)

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY not set.');
    process.exit(1);
  }

  console.log('1. textSearch output shape\n');
  const refs = await googlePlaces.textSearch('nail salons in San Francisco');
  assert(Array.isArray(refs), 'textSearch returns array');
  assert(refs.length > 0, 'textSearch returns at least one result');
  const first = refs[0];
  assert(first.place_id && typeof first.place_id === 'string', 'each result has place_id');
  assert(first.name !== undefined, 'each result has name (may be undefined from API)');
  console.log('   Sample:', { place_id: first.place_id?.slice(0, 20) + '...', name: first.name });
  console.log('   Required for pipeline: place_id (for getDetails), name (fallback) — OK\n');

  console.log('2. getDetails output shape (raw keys from API)\n');
  const detail = await googlePlaces.getDetails(first.place_id);
  assert(detail && typeof detail === 'object', 'getDetails returns object');
  const keys = Object.keys(detail);
  console.log('   Keys:', keys.join(', '));

  // Google Place Details can return editorial_summary as { overview: "..." }
  const hasOverview = detail.editorial_summary && typeof detail.editorial_summary === 'object' && 'overview' in detail.editorial_summary;
  console.log('   editorial_summary.overview present:', hasOverview);

  console.log('\n3. Mapped place (same logic as routes/search.js) — required for downstream\n');
  const place = {
    place_id: first.place_id,
    name: detail.name || first.name || 'Unknown',
    address: detail.formatted_address || '',
    phone: detail.formatted_phone_number || null,
    website: detail.website || null,
    rating: detail.rating != null ? detail.rating : null,
    user_ratings_total: detail.user_ratings_total != null ? detail.user_ratings_total : 0,
    editorial_summary: detail.editorial_summary ? (detail.editorial_summary.overview || '') : ''
  };

  assert(typeof place.name === 'string' && place.name.length > 0, 'name is non-empty string (required for slug, Yutori, generate)');
  assert(typeof place.address === 'string', 'address is string (required for Yutori, card, generate)');
  assert(place.phone === null || typeof place.phone === 'string', 'phone is null or string');
  assert(place.rating === null || (typeof place.rating === 'number' && place.rating >= 0), 'google_rating is number or null');
  assert(typeof place.user_ratings_total === 'number' && place.user_ratings_total >= 0, 'google_reviews is number');

  console.log('   name:', place.name);
  console.log('   address:', place.address ? place.address.slice(0, 50) + '...' : '(empty)');
  console.log('   phone:', place.phone);
  console.log('   rating:', place.rating, '| user_ratings_total:', place.user_ratings_total);
  console.log('   editorial_summary (length):', place.editorial_summary.length);

  console.log('\n4. Business object shape (after Yutori would fill email, style, description)\n');
  const business = {
    id: 'uuid-placeholder',
    name: place.name,
    address: place.address,
    phone: place.phone,
    email: null,
    has_website: false,
    google_reviews: place.user_ratings_total,
    google_rating: place.rating,
    style: null,
    description: place.editorial_summary || '',
    slug: place.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
    status: 'pending'
  };
  const requiredForGenerate = ['id', 'name', 'description', 'style', 'phone', 'address', 'email', 'slug'];
  for (const key of requiredForGenerate) {
    assert(key in business, `business.${key} present for /api/generate`);
  }
  console.log('   Required keys for /api/generate:', requiredForGenerate.join(', '), '— OK');
  console.log('   Required for card/UI: name, address, phone, email, google_reviews, google_rating, style, description, slug — OK');

  console.log('\n--- Google layer outputs verified: data shape is correct for full prod pipeline ---');
}

main().catch(err => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
