// --- DEV A owns this file ---
// Yutori API: POST/GET https://api.yutori.com/v1/research/tasks, header X-API-Key

const API_KEY = process.env.YUTORI_API_KEY;
const BASE_URL = 'https://api.yutori.com/v1/research/tasks';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 1200000; // 20 minutes — no other timeouts

function buildQuery(businessName, address) {
  return `Research the business '${businessName}' at ${address}. ` +
    `Use Yelp as your primary source; you may also use Google Reviews, Facebook, TripAdvisor, and other review or directory sites. ` +
    `Find: any email address, phone number, business hours (opening/closing times), social media links, and a short description of the business vibe and customer experience (do not repeat the address or phone in the description). ` +
    `Then suggest a visual website style (e.g. 'modern minimalist', 'warm and luxurious', 'clean and clinical') based on what you find, and include 3-5 objects or themes that represent the business (e.g. 'espresso cup, coffee beans, rustic wood' for a café). ` +
    `Finally, suggest a website color palette that authentically matches what this type of business would actually use. Output it in EXACTLY this format on its own line:\n` +
    `COLOR_PALETTE: theme=dark|light, bg=#hex, text=#hex, accent=#hex, accent2=#hex\n` +
    `Choose colors that match the INDUSTRY and VIBE — e.g. a gun shop or tattoo parlor should use dark themes with blacks/gunmetals/brass; a nail salon might use soft pastels; a barbershop might use dark moody tones with gold; a bakery might use warm creams. Match the business identity, not a generic template.\n` +
    `Also suggest ONE 3D object keyword for a floating background decoration from a 3D model library (e.g. "pistol", "coffee_cup", "chair", "flower_pot", "barber_chair"). Output it on its own line:\n` +
    `3D_ASSET: keyword\n` +
    `Be as concise as possible. Call as few tools as possible — only enough to get the minimum required information.`;
}

// Create a research task for a business
async function createTask(businessName, address) {
  if (!API_KEY) throw new Error('YUTORI_API_KEY is not set');
  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: buildQuery(businessName, address) })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Yutori create failed: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const taskId = data.task_id || data.id;
  if (!taskId) throw new Error('Yutori response missing task_id');
  return { task_id: taskId };
}

// Strip all HTML and decode entities so JSON/downstream get plain text only
function stripHtml(html) {
  if (html == null || typeof html !== 'string') return '';
  let s = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/\s+/g, ' ')
    .trim();
  return s;
}

// Extract mainstream social/directory URLs only (no HTML in output)
function extractSocialLinks(text) {
  if (!text || typeof text !== 'string') return [];
  const urlRe = /https?:\/\/(?:www\.)?(?:facebook|instagram|twitter|x\.com|linkedin|yelp|youtube|tiktok|pinterest)\.com\/[^\s<>"']+|https?:\/\/(?:www\.)?threads\.net\/[^\s<>"']+/gi;
  const seen = new Set();
  const list = [];
  let m;
  const re = new RegExp(urlRe.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    const url = m[0].replace(/[.,;:)]+$/, '');
    if (!seen.has(url.toLowerCase())) {
      seen.add(url.toLowerCase());
      list.push(url);
    }
  }
  return list.slice(0, 10);
}

// Parse Yutori result: extract email, style, description (vibe only), phone, business_hours, social_media_links
function parseResult(text) {
  const out = { email: null, style: null, description: '', phone: null, business_hours: null, social_media_links: [], color_palette: null, asset_keyword: null };
  if (!text || typeof text !== 'string') return out;
  const raw = text.trim();
  const t = stripHtml(raw);
  if (!t) return out;
  // Color palette — COLOR_PALETTE: theme=dark, bg=#0a0a0a, text=#f5f5f5, accent=#b5a642, accent2=#4a5568
  const paletteMatch = t.match(/COLOR_PALETTE:\s*theme\s*=\s*(dark|light)\s*,\s*bg\s*=\s*(#[0-9a-fA-F]{3,8})\s*,\s*text\s*=\s*(#[0-9a-fA-F]{3,8})\s*,\s*accent\s*=\s*(#[0-9a-fA-F]{3,8})\s*,\s*accent2\s*=\s*(#[0-9a-fA-F]{3,8})/i);
  if (paletteMatch) {
    out.color_palette = {
      theme: paletteMatch[1].toLowerCase(),
      bg: paletteMatch[2],
      text: paletteMatch[3],
      accent: paletteMatch[4],
      accent2: paletteMatch[5],
    };
  }
  // 3D asset keyword — 3D_ASSET: pistol
  const assetMatch = t.match(/3D_ASSET:\s*([^\n.,]+)/i);
  if (assetMatch) out.asset_keyword = assetMatch[1].trim().toLowerCase() || null;
  // Email
  const emailMatch = t.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (emailMatch) out.email = emailMatch[0];
  // Phone (supplement when Google has none)
  const phoneMatch = t.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  if (phoneMatch) out.phone = phoneMatch[0].replace(/\s+/g, ' ').trim();
  // Business hours
  const hoursMatch = t.match(/(?:Hours?|Opening|Business hours?)\s*[:\-–—]\s*([^.]+?)(?=\s*[A-Z][a-z]*\s*[:\-–—]|\s*$)/i) ||
    t.match(/((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[^.]*?(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM)|closed))/i);
  if (hoursMatch) out.business_hours = stripHtml(hoursMatch[1]).trim().slice(0, 200);
  // Social media links (from raw to catch hrefs; then strip HTML and scan plain text)
  const rawLinks = extractSocialLinks(raw);
  const plainLinks = extractSocialLinks(t);
  const allLinks = [...rawLinks, ...plainLinks];
  const seen = new Set();
  out.social_media_links = allLinks.filter(u => {
    const n = u.toLowerCase();
    if (seen.has(n)) return false;
    seen.add(n);
    return true;
  }).slice(0, 10);
  // Style
  const styleMatch = t.match(/(?:style|visual style|suggest.*?)(?::| -|—)\s*["']?([^."'\n]+)/i) ||
    t.match(/(?:modern minimalist|warm and luxurious|clean and clinical|[a-z]+ and [a-z]+)/i);
  if (styleMatch) out.style = stripHtml(styleMatch[1] || styleMatch[0]).trim() || null;
  // Description: vibe/summary only
  let descText = t
    .replace(/(?:Address|Phone|Hours?|Email|Website|Social\s*media)\s*[:\-–—][^.]*\.?/gi, ' ')
    .replace(/\s*\(\d{3}\)\s*\d{3}[-.]?\d{4}\s*/g, ' ')
    .replace(/\d{1,5}\s+[\w\s]+(?:St|Ave|Blvd|Rd)[^.]*\.?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const sentences = descText.split(/(?<=[.!?])\s+/).filter(Boolean);
  out.description = stripHtml(sentences.slice(0, 2).join(' ').trim() || descText.slice(0, 300)).trim().slice(0, 500) || '';
  return out;
}

// Poll task until completion (3s interval, 10 min timeout only)
async function pollTask(taskId) {
  if (!API_KEY) throw new Error('YUTORI_API_KEY is not set');
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const res = await fetch(`${BASE_URL}/${taskId}`, {
      headers: { 'X-API-Key': API_KEY }
    });

    if (!res.ok) {
      throw new Error(`Yutori poll failed: ${res.status}`);
    }

    const task = await res.json();
    const status = task.status || task.state;

    if (status === 'succeeded' || status === 'completed' || status === 'done') {
      const raw = task.result || task.text || task.output || '';
      const parsed = parseResult(raw);
      return { ...parsed, rawText: raw };
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(task.error_message || task.message || 'Yutori task failed');
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('Yutori poll timeout');
}

module.exports = { createTask, pollTask, buildQuery };
