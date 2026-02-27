// --- DEV A owns this file ---
const express = require('express');
const router = express.Router();
const googlePlaces = require('../services/google-places');
const yutori = require('../services/yutori');
const { readData, writeData } = require('../lib/store');
const { v4: uuidv4 } = require('uuid');

// In-memory search tracking
const searches = {};

// POST /api/search — kick off discovery pipeline
router.post('/search', async (req, res) => {
  const { query } = req.body;
  const searchId = uuidv4();

  searches[searchId] = { status: 'pending', businesses: [], completed: 0, total: 0 };
  res.json({ search_id: searchId });

  // TODO: Dev A implements pipeline
  // 1. Google Places textsearch → get place IDs
  // 2. Google Places details for each → filter has_website=false
  // 3. For each: kick off Yutori research task
  // 4. Poll Yutori tasks, parse results
  // 5. Save to businesses.json
  // 6. Trigger /api/generate for each business (auto-pipeline)
});

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
