// --- DEV A — slug for place name: lowercase, spaces to hyphens, strip non-alphanumeric

function slugify(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'business';
}

module.exports = { slugify };
