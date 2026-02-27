// --- DEV A — validate search query (Google returns results even without location) ---

/**
 * Validates that the user query is present and non-empty.
 * Location is not required; Google returns results for category-only queries too.
 * @param {string} query - Raw search query
 * @returns {{ valid: boolean, error?: string }}
 */
function validateSearchQuery(query) {
  const q = (query || '').trim();
  if (q.length === 0) {
    return { valid: false, error: 'Missing or empty query' };
  }
  return { valid: true };
}

module.exports = { validateSearchQuery };
