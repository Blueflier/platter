// --- DEV A owns this file ---

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Search for businesses by text query
async function textSearch(query) {
  if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  const url = new URL(`${BASE_URL}/textsearch/json`);
  url.searchParams.set('query', query);
  url.searchParams.set('key', API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status === 'REQUEST_DENIED') {
    throw new Error(data.error_message || 'Google Places request denied');
  }

  return (data.results || []).map(r => ({ place_id: r.place_id, name: r.name }));
}

// Get place details (website, phone, reviews)
async function getDetails(placeId) {
  if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  const url = new URL(`${BASE_URL}/details/json`);
  url.searchParams.set('place_id', placeId);
  url.searchParams.set('fields', 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,editorial_summary,opening_hours');
  url.searchParams.set('key', API_KEY);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status === 'REQUEST_DENIED') {
    throw new Error(data.error_message || 'Google Places request denied');
  }
  if (data.status !== 'OK') {
    return null;
  }

  return data.result || {};
}

module.exports = { textSearch, getDetails };
