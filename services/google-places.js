// --- DEV A owns this file ---

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Search for businesses by text query
async function textSearch(query) {
  // TODO: Dev A implements
  // GET https://maps.googleapis.com/maps/api/place/textsearch/json?query=...&key=...
  return [];
}

// Get place details (website, phone, reviews)
async function getDetails(placeId) {
  // TODO: Dev A implements
  // GET https://maps.googleapis.com/maps/api/place/details/json?place_id=...&fields=...&key=...
  return {};
}

module.exports = { textSearch, getDetails };
