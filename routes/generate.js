// --- DEV B owns this file ---
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const pioneer = require('../services/pioneer');
const render = require('../services/render');
const { readData, writeData } = require('../lib/store');

const WEBSITES_DIR = path.join(__dirname, '..', 'websites');

// POST /api/generate — generate site, deploy, return draft
router.post('/generate', async (req, res) => {
  const { id, name, description, style, phone, address, email, slug } = req.body;

  if (!slug || !name) {
    return res.status(400).json({ error: 'Missing required fields: slug, name' });
  }

  try {
    // 1. Generate HTML via Pioneer
    const html = await pioneer.generateSite({ name, description, style, phone, address });

    // 2. Write to websites/{slug}/index.html
    const siteDir = path.join(WEBSITES_DIR, slug);
    await fs.mkdir(siteDir, { recursive: true });
    await fs.writeFile(path.join(siteDir, 'index.html'), html);

    // 3. Deploy via Render
    const liveUrl = await render.deploy(slug);

    // 4. Update generated.json
    const generated = await readData('generated.json');
    generated.push({
      id,
      name,
      slug,
      live_url: liveUrl,
      email: email || null,
      generated_at: new Date().toISOString(),
      status: 'active'
    });
    await writeData('generated.json', generated);

    // 5. Update business status in businesses.json
    const businesses = await readData('businesses.json');
    const biz = businesses.find(b => b.id === id);
    if (biz) {
      biz.status = 'deployed';
      biz.live_url = liveUrl;
      await writeData('businesses.json', businesses);
    }

    // 6. Build email draft
    const emailDraft = email
      ? `Subject: We built you a free website\n\nHi ${name},\n\nWe noticed you didn't have a website so we built one for you — take a look:\n${liveUrl}\n\nHappy to chat if you have questions.\n— Platter`
      : null;

    res.json({
      live_url: liveUrl,
      business_name: name,
      email_draft: emailDraft
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: 'Generation failed' });
  }
});

module.exports = router;
