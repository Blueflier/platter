// --- DEV A owns this file ---

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const BASE_URL = 'https://maps.googleapis.com/maps/api/place';

// Search for businesses by text query.
// Optional: locationBias = { lat, lng } or "lat,lng", radiusMeters = number (biases results within that circle).
async function textSearch(query, opts = {}) {
  if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  const url = new URL(`${BASE_URL}/textsearch/json`);
  url.searchParams.set('query', query);
  url.searchParams.set('key', API_KEY);
  if (opts.locationBias) {
    const { lat, lng } = typeof opts.locationBias === 'string'
      ? (() => { const [a, b] = opts.locationBias.split(',').map(Number); return { lat: a, lng: b }; })()
      : opts.locationBias;
    if (lat != null && lng != null) {
      url.searchParams.set('location', `${lat},${lng}`);
      if (opts.radiusMeters != null) url.searchParams.set('radius', String(opts.radiusMeters));
    }
  }
  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status === 'REQUEST_DENIED') {
    throw new Error(data.error_message || 'Google Places request denied');
  }

  return (data.results || []).map(r => ({ place_id: r.place_id, name: r.name }));
}

// Fetch multiple pages of text search results (Google returns 20 per page; next_page_token requires ~2s delay).
// Returns up to maxResults place refs (default 60 = 3 pages) so we have more candidates to filter to no-website.
async function textSearchAllPages(query, opts = {}, maxResults = 60) {
  if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY is not set');
  const all = [];
  let nextPageToken = null;
  let first = true;

  while (all.length < maxResults) {
    const url = new URL(`${BASE_URL}/textsearch/json`);
    if (first) {
      url.searchParams.set('query', query);
      url.searchParams.set('key', API_KEY);
      if (opts.locationBias) {
        const { lat, lng } = typeof opts.locationBias === 'string'
          ? (() => { const [a, b] = opts.locationBias.split(',').map(Number); return { lat: a, lng: b }; })()
          : opts.locationBias;
        if (lat != null && lng != null) {
          url.searchParams.set('location', `${lat},${lng}`);
          if (opts.radiusMeters != null) url.searchParams.set('radius', String(opts.radiusMeters));
        }
      }
      first = false;
    } else {
      if (!nextPageToken) break;
      url.searchParams.set('pagetoken', nextPageToken);
      url.searchParams.set('key', API_KEY);
      await new Promise(r => setTimeout(r, 2200)); // token not valid immediately
    }

    const res = await fetch(url.toString());
    const data = await res.json();

    if (data.status === 'REQUEST_DENIED') {
      throw new Error(data.error_message || 'Google Places request denied');
    }
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      break;
    }

    const page = (data.results || []).map(r => ({ place_id: r.place_id, name: r.name }));
    const seen = new Set(all.map(r => r.place_id));
    for (const r of page) {
      if (seen.has(r.place_id)) continue;
      seen.add(r.place_id);
      all.push(r);
      if (all.length >= maxResults) break;
    }

    nextPageToken = data.next_page_token || null;
    if (!nextPageToken || page.length === 0) break;
  }

  return all.slice(0, maxResults);
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

module.exports = { textSearch, textSearchAllPages, getDetails };
