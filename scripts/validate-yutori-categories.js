/**
 * Validate Yutori output is category-appropriate: stress test across many
 * business types using real Google places. Ensures description, style, and
 * themes/objects are not from a wrong industry (e.g. gun shop getting salon copy).
 *
 * Usage: node scripts/validate-yutori-categories.js
 * Requires: GOOGLE_PLACES_API_KEY, YUTORI_API_KEY in .env
 * Timeout: ~10 min per Yutori task; run can be long with many categories.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const googlePlaces = require('../services/google-places');
const yutori = require('../services/yutori');

// Wide variety + niche categories. forbidden = terms that must NOT appear (wrong industry).
const CATEGORIES = [
  { query: 'gun shop in San Francisco', label: 'gun_shop', forbidden: ['manicure', 'pedicure', 'nail salon', 'nail polish', 'spa', 'beauty', 'facial', 'acrylic', 'gel nails', 'massage', 'haircut', 'salon'] },
  { query: 'nail salon in Oakland', label: 'nail_salon', forbidden: ['firearm', 'ammunition', 'gun', 'rifle', 'hunting', 'weapon', 'shooting range'] },
  { query: 'café coffee shop in Berkeley', label: 'cafe', forbidden: ['firearm', 'ammunition', 'manicure', 'dental', 'veterinar'] },
  { query: 'plumber in Oakland', label: 'plumber', forbidden: ['manicure', 'espresso', 'latte', 'firearm', 'tattoo'] },
  { query: 'bakery in San Francisco', label: 'bakery', forbidden: ['firearm', 'ammunition', 'auto repair', 'transmission'] },
  { query: 'tattoo shop in San Francisco', label: 'tattoo', forbidden: ['manicure', 'pedicure', 'gel nails', 'firearm', 'bakery', 'croissant'] },
  { query: 'veterinarian in Oakland', label: 'vet', forbidden: ['manicure', 'nail salon', 'firearm', 'espresso', 'bakery'] },
  { query: 'florist in Berkeley', label: 'florist', forbidden: ['firearm', 'ammunition', 'auto repair', 'transmission'] },
  { query: 'auto repair shop in San Francisco', label: 'auto_repair', forbidden: ['manicure', 'pedicure', 'nail', 'spa', 'flower bouquet'] },
  { query: 'yoga studio in Oakland', label: 'yoga', forbidden: ['firearm', 'ammunition', 'gun', 'auto repair', 'transmission'] },
  { query: 'comic book store in San Francisco', label: 'comic_book', forbidden: ['manicure', 'spa', 'firearm', 'ammunition', 'yoga pose'] },
  { query: 'thrift store in Oakland', label: 'thrift', forbidden: ['manicure', 'firearm', 'ammunition', 'dental', 'veterinar'] },
];

const YUTORI_POLL_TIMEOUT_MS = 600000; // 10 min
const PLACES_PER_CATEGORY = 1; // use first no-website place per category

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function containsForbidden(text, forbiddenList) {
  if (!text || typeof text !== 'string') return { found: [], clean: true };
  const lower = text.toLowerCase();
  const found = forbiddenList.filter(term => lower.includes(term.toLowerCase()));
  return { found, clean: found.length === 0 };
}

async function getOneNoWebsitePlace(query) {
  const refs = await googlePlaces.textSearch(query);
  for (const ref of refs.slice(0, 5)) {
    const detail = await googlePlaces.getDetails(ref.place_id);
    if (!detail) continue;
    if (detail.website) continue;
    return {
      name: detail.name || ref.name || 'Unknown',
      address: detail.formatted_address || ''
    };
  }
  return null;
}

async function runOneCategory(cat) {
  const place = await getOneNoWebsitePlace(cat.query);
  if (!place) {
    return { label: cat.label, query: cat.query, skipped: true, reason: 'no no-website place found' };
  }

  let taskId;
  try {
    const created = await yutori.createTask(place.name, place.address);
    taskId = created.task_id;
  } catch (err) {
    return { label: cat.label, query: cat.query, place: place.name, error: err.message };
  }

  let parsed;
  try {
    const result = await yutori.pollTask(taskId);
    parsed = result;
  } catch (err) {
    return { label: cat.label, query: cat.query, place: place.name, error: `Yutori poll: ${err.message}` };
  }

  const descCheck = containsForbidden(parsed.description || '', cat.forbidden);
  const styleCheck = containsForbidden(parsed.style || '', cat.forbidden);
  const themesText = Array.isArray(parsed.themes_or_objects) ? parsed.themes_or_objects.join(' ') : (parsed.themes_or_objects || '');
  const themesCheck = containsForbidden(themesText, cat.forbidden);

  const passed = descCheck.clean && styleCheck.clean && themesCheck.clean;
  return {
    label: cat.label,
    query: cat.query,
    place: place.name,
    passed,
    description: { clean: descCheck.clean, found: descCheck.found },
    style: { clean: styleCheck.clean, found: styleCheck.found },
    themes_or_objects: { clean: themesCheck.clean, found: themesCheck.found, value: parsed.themes_or_objects },
    snippet: (parsed.description || '').slice(0, 120) + (parsed.style ? ` | style: ${parsed.style}` : '')
  };
}

async function main() {
  if (!process.env.GOOGLE_PLACES_API_KEY || !process.env.YUTORI_API_KEY) {
    console.error('Need GOOGLE_PLACES_API_KEY and YUTORI_API_KEY in .env');
    process.exit(1);
  }

  console.log('Yutori category validation: wide variety + niche, real Google places\n');
  console.log('Categories:', CATEGORIES.length);
  console.log('Per category: 1 no-website place, then Yutori research, then forbidden-term check\n');

  const results = [];
  for (let i = 0; i < CATEGORIES.length; i++) {
    const cat = CATEGORIES[i];
    console.log(`[${i + 1}/${CATEGORIES.length}] ${cat.label}: ${cat.query}`);
    const out = await runOneCategory(cat);
    results.push(out);
    if (out.skipped) {
      console.log('  Skipped:', out.reason);
    } else if (out.error) {
      console.log('  Error:', out.error);
    } else if (out.passed) {
      console.log('  OK — description, style, themes appropriate');
    } else {
      console.log('  FAIL — wrong-category terms found');
      if (out.description && !out.description.clean) console.log('    description:', out.description.found);
      if (out.style && !out.style.clean) console.log('    style:', out.style.found);
      if (out.themes_or_objects && !out.themes_or_objects.clean) console.log('    themes:', out.themes_or_objects.found);
    }
  }

  const passed = results.filter(r => r.passed === true).length;
  const failed = results.filter(r => r.passed === false).length;
  const skipped = results.filter(r => r.skipped).length;
  const errors = results.filter(r => r.error).length;

  console.log('\n--- Summary ---');
  console.log('Passed:', passed);
  console.log('Failed (wrong category):', failed);
  console.log('Skipped (no place):', skipped);
  console.log('Errors (API/timeout):', errors);

  if (failed > 0) {
    console.log('\nFailed categories:');
    results.filter(r => r.passed === false).forEach(r => {
      console.log(`  ${r.label} (${r.place})`);
    });
    process.exit(1);
  }
  console.log('\n--- Yutori category validation passed. ---');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
