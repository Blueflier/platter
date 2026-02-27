// --- DEV B owns this file ---
const express = require('express');
const router = express.Router();
const { readData, writeData } = require('../lib/store');

// PATCH /api/businesses/:id — update status (save for later, etc.)
router.patch('/businesses/:id', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const businesses = await readData('businesses.json');
    const biz = businesses.find(b => b.id === id);
    if (!biz) return res.status(404).json({ error: 'Business not found' });

    biz.status = status;
    await writeData('businesses.json', businesses);
    res.json({ ok: true });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Update failed' });
  }
});

// POST /api/businesses/save — bulk save businesses (used by Dev A pipeline)
router.post('/businesses/save', async (req, res) => {
  try {
    const businesses = req.body;
    await writeData('businesses.json', businesses);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Save failed' });
  }
});

module.exports = router;
