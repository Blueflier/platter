// --- DEV B owns this file ---
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const pioneer = require('../services/pioneer');
const render = require('../services/render');
const { appendData, updateData } = require('../lib/store');

const WEBSITES_DIR = path.join(__dirname, '..', 'websites');

// POST /api/generate — generate site, deploy, return draft
router.post('/generate', async (req, res) => {
  const { id, name, description, style, phone, address, email, slug, business_hours, social_media_links } = req.body;

  if (!slug || !name) {
    return res.status(400).json({ error: 'Missing required fields: slug, name' });
  }

  try {
    // 1. Generate HTML via Pioneer
    const html = await pioneer.generateSite({ name, description, style, phone, address, email, business_hours, social_media_links });

    // 2. Write to websites/{slug}/index.html
    const siteDir = path.join(WEBSITES_DIR, slug);
    await fs.mkdir(siteDir, { recursive: true });
    await fs.writeFile(path.join(siteDir, 'index.html'), html);

    // 3. Deploy via Render (push to GitHub + create Render static site)
    const liveUrl = await render.deploy(slug, html);

    // 4. Update generated.json (atomic append)
    await appendData('generated.json', {
      id,
      name,
      slug,
      live_url: liveUrl,
      email: email || null,
      generated_at: new Date().toISOString(),
      status: 'active'
    });

    // 5. Update business status in businesses.json (atomic update)
    await updateData('businesses.json', b => b.id === id, biz => {
      biz.status = 'deployed';
      biz.live_url = liveUrl;
    });

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
