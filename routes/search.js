// --- DEV A owns this file ---
const express = require('express');
const router = express.Router();
const googlePlaces = require('../services/google-places');
const yutori = require('../services/yutori');
const { readData, writeData } = require('../lib/store');
const { slugify } = require('../lib/slug');
const { validateSearchQuery } = require('../lib/query-validation');
const { v4: uuidv4 } = require('uuid');
const { alreadyExists } = require('../lib/dedupe');

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
  searches[searchId] = { status: 'pending', businesses: [], completed: 0, total: 0 };
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

  let placeRefs = [];
  try {
    placeRefs = await googlePlaces.textSearch(query);
  } catch (err) {
    console.error('Google Places textSearch:', err);
    search.status = 'failed';
    return;
  }

  const noWebsitePlaces = [];
  for (const ref of placeRefs) {
    try {
      const detail = await googlePlaces.getDetails(ref.place_id);
      if (!detail) continue;
      if (detail.website) continue; // has website — skip
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

  search.total = toProcess.length;
  if (toProcess.length === 0) {
    search.status = 'completed';
    return;
  }

  // One Yutori task per place; run all in parallel (each: create -> poll -> append -> generate)
  const runOne = async (place) => {
    const slug = slugify(place.name);
    let taskId;
    try {
      const created = await yutori.createTask(place.name, place.address);
      taskId = created.task_id;
    } catch (err) {
      console.error('Yutori create error for', place.name, err.message);
      return;
    }

    let email = null, style = null, description = '', phoneSupplement = null, businessHours = null, socialMediaLinks = [];
    try {
      const parsed = await yutori.pollTask(taskId);
      email = parsed.email;
      style = parsed.style;
      description = parsed.description || '';
      phoneSupplement = parsed.phone || null;
      businessHours = parsed.business_hours || null;
      socialMediaLinks = Array.isArray(parsed.social_media_links) ? parsed.social_media_links : [];
    } catch (err) {
      console.error('Yutori poll error for', place.name, err.message);
      description = place.editorial_summary || '';
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
      slug,
      status: 'pending'
    };

    // Append one business to businesses.json (read -> append -> write)
    try {
      const list = await readData('businesses.json');
      list.push({ ...business });
      await writeData('businesses.json', list);
    } catch (err) {
      console.error('Store append error:', err);
    }

    // Call POST /api/generate for this business
    let liveUrl = null;
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
          slug
        })
      });
      if (genRes.ok) {
        const gen = await genRes.json();
        liveUrl = gen.live_url || null;
        emailDraft = gen.email_draft || null;
      }
    } catch (err) {
      console.error('Generate call error for', place.name, err.message);
    }

    const card = {
      ...business,
      live_url: liveUrl,
      email_draft: emailDraft,
      status: liveUrl ? 'deployed' : business.status
    };

    search.businesses.push(card);
    search.completed += 1;
    if (search.completed >= search.total) {
      search.status = 'completed';
    }
  };

  await Promise.all(toProcess.map(runOne));
}

// GET /api/search/:search_id/status
router.get('/search/:search_id/status', (req, res) => {
  const search = searches[req.params.search_id];
  if (!search) return res.status(404).json({ error: 'Search not found' });
  res.json({
    status: search.status,
    completed: search.completed,
    total: search.total
  });
});

// GET /api/results/:search_id
router.get('/results/:search_id', (req, res) => {
  const search = searches[req.params.search_id];
  if (!search) return res.status(404).json({ error: 'Search not found' });
  res.json(search.businesses);
});

module.exports = router;
