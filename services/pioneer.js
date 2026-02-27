// --- DEV B owns this file ---

const API_KEY = process.env.PIONEER_API_KEY;
const ENDPOINT = process.env.PIONEER_ENDPOINT;
const MODEL_ID = process.env.PIONEER_MODEL_ID;

// Generate landing page HTML for a business
async function generateSite({ name, description, style, phone, address }) {
  // TODO: call Pioneer API once request/response format is confirmed
  //
  // const res = await fetch(ENDPOINT, {
  //   method: 'POST',
  //   headers: {
  //     'Authorization': `Bearer ${API_KEY}`,
  //     'Content-Type': 'application/json'
  //   },
  //   body: JSON.stringify({ model_id: MODEL_ID, name, description, style, phone, address })
  // });
  // const { html } = await res.json();
  // return html;

  // Placeholder: return a styled landing page
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(name)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #fafafa; color: #1a1a1a; }
    .hero { padding: 4rem 2rem; text-align: center; background: #111; color: #fff; }
    .hero h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .hero p { font-size: 1.1rem; opacity: 0.8; max-width: 500px; margin: 0 auto; }
    .info { max-width: 600px; margin: 2rem auto; padding: 0 1.5rem; }
    .info p { margin-bottom: 0.75rem; font-size: 1rem; line-height: 1.6; }
    .cta { display: inline-block; margin-top: 1rem; padding: 0.75rem 2rem; background: #111; color: #fff; text-decoration: none; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="hero">
    <h1>${escHtml(name)}</h1>
    <p>${escHtml(description || '')}</p>
  </div>
  <div class="info">
    ${address ? `<p>${escHtml(address)}</p>` : ''}
    ${phone ? `<p>Call us: ${escHtml(phone)}</p>` : ''}
    <a class="cta" href="tel:${escHtml(phone || '')}">Get in Touch</a>
  </div>
</body>
</html>`;
}

function escHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

module.exports = { generateSite };
