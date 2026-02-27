/**
 * One-off script to verify .env keys work against Google Places and Yutori.
 * Run: node scripts/test-api-keys.js
 * No key values are printed.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
const YUTORI_KEY = process.env.YUTORI_API_KEY;

function hasKey(val) {
  return typeof val === 'string' && val.length > 0;
}

async function testGooglePlaces() {
  console.log('\n--- Google Places API ---');
  if (!hasKey(GOOGLE_KEY)) {
    console.log('FAIL: GOOGLE_PLACES_API_KEY missing or empty in .env');
    return false;
  }
  console.log('GOOGLE_PLACES_API_KEY: present');

  const textSearchUrl = new URL('https://maps.googleapis.com/maps/api/place/textsearch/json');
  textSearchUrl.searchParams.set('query', 'nail salons in San Francisco');
  textSearchUrl.searchParams.set('key', GOOGLE_KEY);

  let res = await fetch(textSearchUrl.toString());
  let data = await res.json();

  if (data.status === 'REQUEST_DENIED') {
    console.log('FAIL: Request denied —', data.error_message || 'check key and APIs enabled');
    return false;
  }
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.log('FAIL: Unexpected status —', data.status, data.error_message || '');
    return false;
  }

  const results = data.results || [];
  console.log('Text Search: OK —', results.length, 'place(s) returned');

  if (results.length === 0) {
    console.log('(No places to test Details; key is valid.)');
    return true;
  }

  const placeId = results[0].place_id;
  const detailsUrl = new URL('https://maps.googleapis.com/maps/api/place/details/json');
  detailsUrl.searchParams.set('place_id', placeId);
  detailsUrl.searchParams.set('fields', 'name,formatted_address,formatted_phone_number,website,rating,user_ratings_total,editorial_summary');
  detailsUrl.searchParams.set('key', GOOGLE_KEY);

  res = await fetch(detailsUrl.toString());
  data = await res.json();

  if (data.status === 'REQUEST_DENIED') {
    console.log('FAIL: Details denied —', data.error_message || '');
    return false;
  }
  if (data.status !== 'OK') {
    console.log('FAIL: Details status —', data.status);
    return false;
  }

  const place = data.result || {};
  console.log('Place Details: OK — name =', place.name || '(none)');
  return true;
}

async function testYutori() {
  console.log('\n--- Yutori Research API ---');
  if (!hasKey(YUTORI_KEY)) {
    console.log('FAIL: YUTORI_API_KEY missing or empty in .env');
    return false;
  }
  console.log('YUTORI_API_KEY: present');

  // Yutori docs: POST /v1/research/tasks, header X-API-Key (not Bearer)
  const createRes = await fetch('https://api.yutori.com/v1/research/tasks', {
    method: 'POST',
    headers: {
      'X-API-Key': YUTORI_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: "Research 'Luxe Nails' at 123 Market St San Francisco. Find: any email address, social media links, description of the business vibe. Then suggest a visual website style (e.g. 'modern minimalist', 'warm and luxurious', 'clean and clinical') based on what you find."
    })
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    console.log('FAIL: Create task —', createRes.status, text.slice(0, 200));
    return false;
  }

  const createData = await createRes.json();
  const taskId = createData.task_id || createData.id || createData.taskId;
  if (!taskId) {
    console.log('FAIL: No task_id in response —', JSON.stringify(createData).slice(0, 200));
    return false;
  }
  console.log('Create task: OK — task_id received');

  const deadline = Date.now() + 300_000; // 300s timeout
  const interval = 3000;

  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, interval));
    const getRes = await fetch(`https://api.yutori.com/v1/research/tasks/${taskId}`, {
      headers: { 'X-API-Key': YUTORI_KEY }
    });

    if (!getRes.ok) {
      console.log('FAIL: Poll task —', getRes.status, await getRes.text().then(t => t.slice(0, 150)));
      return false;
    }

    const task = await getRes.json();
    const status = task.status || task.state;
    if (status === 'succeeded' || status === 'completed' || status === 'done' || task.result) {
      console.log('Poll: OK — task completed');
      return true;
    }
    if (status === 'failed' || status === 'error') {
      console.log('FAIL: Task failed —', JSON.stringify(task).slice(0, 200));
      return false;
    }
  }

  console.log('FAIL: Poll timeout (300s)');
  return false;
}

async function main() {
  console.log('Checking .env and testing API keys (no keys printed)...');
  const placesOk = await testGooglePlaces();
  const yutoriOk = await testYutori();
  console.log('\n--- Summary ---');
  console.log('Google Places:', placesOk ? 'OK' : 'FAIL');
  console.log('Yutori:', yutoriOk ? 'OK' : 'FAIL');
  process.exit(placesOk && yutoriOk ? 0 : 1);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
