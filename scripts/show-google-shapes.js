/**
 * Print one full example of Google layer shapes for visual inspection.
 * Run: node scripts/show-google-shapes.js
 * Requires: GOOGLE_PLACES_API_KEY in .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const googlePlaces = require('../services/google-places');
const { slugify } = require('../lib/slug');

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('GOOGLE_PLACES_API_KEY not set.');
    process.exit(1);
  }

  const query = 'nail salons in San Francisco';
  console.log('Query:', query, '\n');

  // 1. textSearch — what we get back (one item)
  const refs = await googlePlaces.textSearch(query);
  const oneRef = refs[0];
  console.log('=== 1. textSearch result (one item) ===');
  console.log(JSON.stringify(oneRef, null, 2));
  console.log('');

  // 2. getDetails — raw API response
  const detail = await googlePlaces.getDetails(oneRef.place_id);
  console.log('=== 2. getDetails raw API response ===');
  console.log(JSON.stringify(detail, null, 2));
  console.log('');

  // 3. Mapped place (same as routes/search.js)
  const place = {
    place_id: oneRef.place_id,
    name: detail.name || oneRef.name || 'Unknown',
    address: detail.formatted_address || '',
    phone: detail.formatted_phone_number || null,
    website: detail.website || null,
    rating: detail.rating != null ? detail.rating : null,
    user_ratings_total: detail.user_ratings_total != null ? detail.user_ratings_total : 0,
    editorial_summary: detail.editorial_summary ? (detail.editorial_summary.overview || '') : ''
  };
  console.log('=== 3. Mapped place (used in pipeline, input to Yutori) ===');
  console.log(JSON.stringify(place, null, 2));
  console.log('');

  // 4. Business object shape (Google fields + placeholders for Yutori)
  const business = {
    id: '<uuid-from-server>',
    name: place.name,
    address: place.address,
    phone: place.phone,
    email: null,
    has_website: false,
    google_reviews: place.user_ratings_total,
    google_rating: place.rating,
    style: null,
    description: place.editorial_summary || '',
    slug: slugify(place.name),
    status: 'pending'
  };
  console.log('=== 4. Business object (Google + Yutori placeholders) → businesses.json / /api/generate ===');
  console.log(JSON.stringify(business, null, 2));
  console.log('\n(Yutori later fills: email, style, description. Generate uses: id, name, description, style, phone, address, email, slug.)');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
