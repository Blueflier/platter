// --- DEV B owns this file ---
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const router = express.Router();
const pioneer = require('../services/pioneer');
const render = require('../services/render');
const { appendData, updateData } = require('../lib/store');

const WEBSITES_DIR = path.join(__dirname, '..', 'websites');

// POST /api/generate — generate 2 site variants, deploy both, return draft
router.post('/generate', async (req, res) => {
  const { id, name, description, style, phone, address, email, slug, business_hours, social_media_links, color_palette, model_url } = req.body;

  if (!slug || !name) {
    return res.status(400).json({ error: 'Missing required fields: slug, name' });
  }

  const sharedArgs = { name, description, style, phone, address, email, business_hours, social_media_links, color_palette };

  try {
    // 1. Generate both variants sequentially (rate limit: 8k output tokens/min)
    const html3d = await pioneer.generateSite({ ...sharedArgs, model_url });
    const htmlClassic = await pioneer.generateClassicSite(sharedArgs);

    const slug3d = `${slug}-3d`;
    const slugClassic = `${slug}-classic`;

    // 2. Write both to websites/{slug-variant}/index.html
    await Promise.all([
      fs.mkdir(path.join(WEBSITES_DIR, slug3d), { recursive: true }).then(() =>
        fs.writeFile(path.join(WEBSITES_DIR, slug3d, 'index.html'), html3d)),
      fs.mkdir(path.join(WEBSITES_DIR, slugClassic), { recursive: true }).then(() =>
        fs.writeFile(path.join(WEBSITES_DIR, slugClassic, 'index.html'), htmlClassic)),
    ]);

    // 3. Deploy both via Render (sequential — they share the same git repo)
    const liveUrl3d = await render.deploy(slug3d, html3d);
    const liveUrlClassic = await render.deploy(slugClassic, htmlClassic);

    // 4. Update generated.json (atomic append)
    await appendData('generated.json', {
      id,
      name,
      slug,
      live_url_3d: liveUrl3d,
      live_url_classic: liveUrlClassic,
      email: email || null,
      generated_at: new Date().toISOString(),
      status: 'active'
    });

    // 5. Update business status in businesses.json (atomic update)
    await updateData('businesses.json', b => b.id === id, biz => {
      biz.status = 'deployed';
      biz.live_url_3d = liveUrl3d;
      biz.live_url_classic = liveUrlClassic;
    });

    // 6. Build email draft with both options
    const emailDraft = email
      ? `Subject: We built you a free website — pick your favorite\n\nHi ${name},\n\nWe noticed you didn't have a website so we built two options for you:\n\nOption A (Interactive 3D): ${liveUrl3d}\nOption B (Classic): ${liveUrlClassic}\n\nTake a look and let us know which one you prefer — or if you'd like any changes.\n\n— Platter`
      : null;

    res.json({
      live_url_3d: liveUrl3d,
      live_url_classic: liveUrlClassic,
      business_name: name,
      email_draft: emailDraft
    });
  } catch (err) {
    console.error('Generate error:', err);
    res.status(500).json({ error: 'Generation failed' });
  }
});

module.exports = router;
