/**
 * One-off: dedupe data/businesses.json and data/generated.json.
 * businesses.json: keep first per (name, address) normalized.
 * generated.json: keep first per slug.
 */
const path = require('path');
const fs = require('fs').promises;
const { normalizeForDedup, normalizeAddress } = require('../lib/dedupe');

const DATA_DIR = path.join(__dirname, '..', 'data');

async function main() {
  const businessesPath = path.join(DATA_DIR, 'businesses.json');
  const generatedPath = path.join(DATA_DIR, 'generated.json');

  let businesses = JSON.parse(await fs.readFile(businessesPath, 'utf-8'));
  const seen = new Set();
  const dedupedBusinesses = businesses.filter((b) => {
    const key = `${normalizeForDedup(b.name)}|${normalizeAddress(b.address)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  let generated = JSON.parse(await fs.readFile(generatedPath, 'utf-8'));
  const seenSlug = new Set();
  const dedupedGenerated = generated.filter((g) => {
    const slug = (g.slug || '').trim().toLowerCase();
    if (!slug || seenSlug.has(slug)) return false;
    seenSlug.add(slug);
    return true;
  });

  await fs.writeFile(businessesPath, JSON.stringify(dedupedBusinesses, null, 2));
  await fs.writeFile(generatedPath, JSON.stringify(dedupedGenerated, null, 2));

  console.log('businesses.json:', businesses.length, '->', dedupedBusinesses.length);
  console.log('generated.json:', generated.length, '->', dedupedGenerated.length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
