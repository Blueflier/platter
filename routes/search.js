// --- DEV A owns this file ---
const express = require('express');
const router = express.Router();
const googlePlaces = require('../services/google-places');
const yutori = require('../services/yutori');
const { readData, writeData, appendData } = require('../lib/store');
const { slugify } = require('../lib/slug');
const { validateSearchQuery } = require('../lib/query-validation');
const { v4: uuidv4 } = require('uuid');
const { alreadyExists } = require('../lib/dedupe');
const polyhaven = require('../services/polyhaven');

const searches = {};
const BASE_URL = `http://localhost:${process.env.PORT || 3000}`;

// POST /api/search — kick off discovery pipeline
router.post('/search', async (req, res) => {
  const { query } = req.body || {};
  const q = typeof query === 'string' ? query.trim() : '';
  const validation = validateSearchQuery(q);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const searchId = uuidv4();
  searches[searchId] = { status: 'pending', businesses: [], completed: 0, total: 0, logs: [] };
  res.json({ search_id: searchId });

  runPipeline(searchId, q).catch(err => {
    console.error('Pipeline error:', err);
    const s = searches[searchId];
    if (s) s.status = 'failed';
  });
});

async function runPipeline(searchId, query) {
  const search = searches[searchId];
  if (!search) return;

  search.status = 'processing';
  const log = (msg) => search.logs.push({ t: Date.now(), msg });

  log(`Searching Google Places for "${query}"...`);

  const googleQuery = / within \d+\s*miles?/i.test(query) ? query : `${query} within 20 miles`;
  let placeRefs = [];
  try {
    placeRefs = await googlePlaces.textSearchAllPages(googleQuery, {}, 60);
  } catch (err) {
    console.error('Google Places textSearch:', err);
    log('Google Places search failed.');
    search.status = 'failed';
    return;
  }

  log(`Found ${placeRefs.length} places (up to 3 pages). Checking for existing websites...`);

  const noWebsitePlaces = [];
  for (let i = 0; i < placeRefs.length; i++) {
    const ref = placeRefs[i];
    try {
      const detail = await googlePlaces.getDetails(ref.place_id);
      if (!detail) continue;
      if (detail.website) {
        log(`${detail.name || ref.name} — has website, skipping`);
        continue;
      }
      log(`${detail.name || ref.name} — no website found`);
      const openingHours = detail.opening_hours && detail.opening_hours.weekday_text && Array.isArray(detail.opening_hours.weekday_text)
        ? detail.opening_hours.weekday_text.join('; ')
        : null;
      noWebsitePlaces.push({
        place_id: ref.place_id,
        name: detail.name || ref.name || 'Unknown',
        address: detail.formatted_address || '',
        phone: detail.formatted_phone_number || null,
        website: detail.website || null,
        rating: detail.rating != null ? detail.rating : null,
        user_ratings_total: detail.user_ratings_total != null ? detail.user_ratings_total : 0,
        editorial_summary: detail.editorial_summary ? (detail.editorial_summary.overview || '') : '',
        opening_hours: openingHours
      });
    } catch (e) {
      console.error('getDetails error for', ref.place_id, e.message);
    }
  }

  // Dedupe: skip places that already exist in data (same name + address)
  let existing = [];
  try {
    existing = await readData('businesses.json');
  } catch (_) {}
  const toProcess = noWebsitePlaces.filter(
    (p) => !alreadyExists(existing, p.name, p.address)
  );
  const dupeCount = noWebsitePlaces.length - toProcess.length;
  if (dupeCount > 0) log(`Skipped ${dupeCount} duplicate(s) already in database.`);

  search.total = toProcess.length;
  if (toProcess.length === 0) {
    log('No new businesses without websites found. Try a different search query.');
    search.status = 'completed';
    return;
  }

  log(`${toProcess.length} businesses to process. Starting enrichment + site generation...`);

  // One Yutori task per place; run all in parallel (each: create -> poll -> append -> generate)
  const runOne = async (place) => {
    const slug = slugify(place.name);
    let taskId;

    log(`[${place.name}] Researching business online...`);
    try {
      const created = await yutori.createTask(place.name, place.address);
      taskId = created.task_id;
    } catch (err) {
      console.error('Yutori create error for', place.name, err.message);
      log(`[${place.name}] Research failed — skipping`);
      search.completed += 1;
      if (search.completed >= search.total) search.status = 'completed';
      return;
    }

    log(`[${place.name}] Waiting for research results...`);
    let email = null, style = null, description = '', phoneSupplement = null, businessHours = null, socialMediaLinks = [], colorPalette = null;
    try {
      const parsed = await yutori.pollTask(taskId);
      email = parsed.email;
      style = parsed.style;
      description = parsed.description || '';
      phoneSupplement = parsed.phone || null;
      businessHours = parsed.business_hours || null;
      socialMediaLinks = Array.isArray(parsed.social_media_links) ? parsed.social_media_links : [];
      colorPalette = parsed.color_palette || null;
      log(`[${place.name}] Research complete${email ? ` — found email: ${email}` : ' — no email found'}`);
      // Look up 3D model from Poly Haven (always tries to find one)
      log(`[${place.name}] Looking up 3D model${parsed.asset_keyword ? ` for "${parsed.asset_keyword}"` : ''}...`);
      try {
        const model = await polyhaven.findModel(parsed.asset_keyword);
        if (model) {
          place._model_url = model.url;
          log(`[${place.name}] Found 3D model: ${model.asset_id}${model.fallback ? ' (curated fallback)' : ''}`);
        } else {
          log(`[${place.name}] No 3D model found — using geometric shapes`);
        }
      } catch (e) {
        log(`[${place.name}] 3D model lookup failed — using geometric shapes`);
      }
    } catch (err) {
      console.error('Yutori poll error for', place.name, err.message);
      description = place.editorial_summary || '';
      log(`[${place.name}] Research timed out — using Google data`);
    }
    const finalPhone = place.phone || phoneSupplement;
    const finalBusinessHours = place.opening_hours || businessHours;

    const id = uuidv4();
    const business = {
      id,
      name: place.name,
      address: place.address,
      phone: finalPhone,
      email: email || null,
      has_website: false,
      google_reviews: place.user_ratings_total,
      google_rating: place.rating,
      style: style || null,
      description: description || place.editorial_summary || '',
      business_hours: finalBusinessHours || null,
      social_media_links: socialMediaLinks,
      color_palette: colorPalette,
      model_url: place._model_url || null,
      slug,
      status: 'pending'
    };

    // Append one business to businesses.json (atomic)
    try {
      await appendData('businesses.json', { ...business });
    } catch (err) {
      console.error('Store append error:', err);
    }

    // Call POST /api/generate for this business (generates 2 variants)
    log(`[${place.name}] Generating websites with AI (3D + Classic)...`);
    let liveUrl3d = null;
    let liveUrlClassic = null;
    let emailDraft = null;
    try {
      const genRes = await fetch(`${BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name: business.name,
          description: business.description,
          style: business.style,
          phone: business.phone,
          address: business.address,
          email: business.email,
          business_hours: business.business_hours || null,
          social_media_links: business.social_media_links || [],
          color_palette: business.color_palette || null,
          model_url: business.model_url || null,
          slug
        })
      });
      if (genRes.ok) {
        const gen = await genRes.json();
        liveUrl3d = gen.live_url_3d || null;
        liveUrlClassic = gen.live_url_classic || null;
        emailDraft = gen.email_draft || null;
        log(`[${place.name}] Websites deployed → 3D: ${liveUrl3d} | Classic: ${liveUrlClassic}`);
      } else {
        log(`[${place.name}] Website generation failed (${genRes.status})`);
      }
    } catch (err) {
      console.error('Generate call error for', place.name, err.message);
      log(`[${place.name}] Website generation error`);
    }

    const card = {
      ...business,
      live_url_3d: liveUrl3d,
      live_url_classic: liveUrlClassic,
      email_draft: emailDraft,
      status: (liveUrl3d || liveUrlClassic) ? 'deployed' : business.status
    };

    search.businesses.push(card);
    search.completed += 1;
    if (search.completed >= search.total) {
      log('All businesses processed.');
      search.status = 'completed';
    }
  };

  // Process businesses one at a time to stay within API rate limits
  for (const place of toProcess) {
    await runOne(place);
  }
}

// GET /api/search/:search_id/status
router.get('/search/:search_id/status', (req, res) => {
  const search = searches[req.params.search_id];
  if (!search) return res.status(404).json({ error: 'Search not found' });
  const since = parseInt(req.query.since) || 0;
  const newLogs = since ? search.logs.filter(l => l.t > since) : search.logs;
  res.json({
    status: search.status,
    completed: search.completed,
    total: search.total,
    logs: newLogs
  });
});

// GET /api/results/:search_id
router.get('/results/:search_id', (req, res) => {
  const search = searches[req.params.search_id];
  if (!search) return res.status(404).json({ error: 'Search not found' });
  res.json(search.businesses);
});

module.exports = router;
