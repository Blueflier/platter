// Normalize for duplicate check: lowercase, trim, collapse whitespace.
// Strip trailing country suffixes so "123 Main St, City, CA 94105" matches "123 Main St, City, CA 94105, USA"
function normalizeForDedup(s) {
  if (s == null || typeof s !== 'string') return '';
  let t = s.trim().toLowerCase().replace(/\s+/g, ' ');
  const suffixes = [', usa', ', u.s.a.', ', united states', ', us'];
  for (const suf of suffixes) {
    if (t.endsWith(suf)) t = t.slice(0, -suf.length).trim();
  }
  return t;
}

// Stronger normalization for address so "107 Stevenson Street" matches "107 Stevenson St"
function normalizeAddress(s) {
  let t = normalizeForDedup(s);
  const abbrev = [
    [/\bstreet\b/g, ' st'],
    [/\bavenue\b/g, ' ave'],
    [/\broad\b/g, ' rd'],
    [/\bboulevard\b/g, ' blvd'],
    [/\bdrive\b/g, ' dr'],
    [/\blane\b/g, ' ln'],
    [/\bplace\b/g, ' pl'],
  ];
  for (const [re, replacement] of abbrev) {
    t = t.replace(re, replacement);
  }
  return t.replace(/\s+/g, ' ').trim();
}

// True if a business with same name and address already exists in the list
function alreadyExists(list, name, address) {
  const n = normalizeForDedup(name);
  const a = normalizeAddress(address);
  if (!n || !a) return false;
  return list.some(
    (b) => normalizeForDedup(b.name) === n && normalizeAddress(b.address) === a
  );
}

module.exports = { normalizeForDedup, normalizeAddress, alreadyExists };
