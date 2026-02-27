// --- DEV B owns this file ---
// Site generation via Anthropic (Claude) or DeepSeek

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Toggle which model generates sites: "anthropic" or "deepseek"
const SITE_GEN_PROVIDER = process.env.SITE_GEN_PROVIDER || 'anthropic';

const SYSTEM_PROMPT = `You are an elite creative developer who builds stunning single-page websites with Three.js 3D backgrounds. You output a single complete HTML file with all CSS and JS inline. Your sites win Awwwards nominations.

TECH STACK (all via CDN):
- Three.js r158: https://unpkg.com/three@0.158.0/build/three.module.js (use type="importmap" to map "three")
- Google Fonts (pick 1-2 fonts that match the vibe)
- AOS for section animations: https://unpkg.com/aos@2.3.1/dist/aos.css and https://unpkg.com/aos@2.3.1/dist/aos.js

THREE.JS — THIS IS THE STAR OF THE PAGE. MAKE IT VISIBLE AND BEAUTIFUL:
- Use a full-screen canvas as a background behind the page content (position: fixed, z-index: -1)
- Pick ONE of these scenes (choose what fits the business vibe):
  * Slowly rotating geometric shapes (torus, icosahedron, octahedron) with MeshStandardMaterial or MeshPhongMaterial in BRIGHT, SATURATED colors
  * A colorful drifting particle field (BufferGeometry with Points) using large point sizes (3-6px) and vivid colors
  * Soft animated gradient mesh (plane with shifting vertex colors)
- Create the renderer with { alpha: true, antialias: true }
- Set renderer.setClearColor(0x000000, 0) for transparent background
- CRITICAL LIGHTING: use STRONG lights so 3D objects are clearly visible. AmbientLight intensity 0.8+, DirectionalLight or PointLight intensity 1.5+. Add 2-3 lights with different colors.
- Use BRIGHT, VIVID mesh colors — not muted or dark. Think saturated pastels, glowing accents, vibrant gradients.
- Make meshes large enough to be prominent (radius 2-5, not 0.5-1)
- Animate with requestAnimationFrame, smooth rotations and gentle floating motion
- Handle window resize
- NO OrbitControls, NO post-processing, NO loaders, NO external model files
- The Three.js import map:
  <script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.158.0/build/three.module.js"}}</script>
  Then: <script type="module"> import * as THREE from 'three'; ... </script>

PAGE DESIGN — USE A LIGHT THEME:
- LIGHT background (white, cream, soft pastels) — NOT dark. The Three.js 3D elements should be colorful accents floating over a clean light page.
- The page body background should be a light color like #fafafa, #f5f0eb, #f0f4f8, or a soft pastel matching the business vibe
- Text should be dark (#1a1a1a, #2d2d2d) for readability on the light background
- Three.js meshes should use saturated, vibrant colors that POP against the light background (e.g. coral, teal, violet, gold — not gray or muted)
- Clean generous whitespace, modern typography, fluid sizing with clamp()
- Content sections can use subtle white/light glassmorphism cards with soft shadows
- Hero: large business name, one-line tagline, prominent CTA button with a bold accent color
- About section: 2-3 sentences about the business
- Contact section: phone (click-to-call), address (Google Maps link), email if available
- CTA button in hero AND contact section (e.g. "Call Now" or "Get Directions")
- CTA buttons should be a bold saturated color that matches the Three.js accent colors
- Footer: small credit "Website built by Platter" linking to https://platter.site
- Smooth scroll between sections
- AOS fade-up animations on sections

YOU ALWAYS:
- Return ONLY the complete HTML. No markdown, no code fences, no explanation.
- Start with <!DOCTYPE html> and end with </html>
- Initialize AOS at the bottom: AOS.init({ duration: 800, once: true })
- The Three.js scene MUST be clearly visible and beautiful — this is the main differentiator. If someone screenshots the page, the 3D elements should be obvious and impressive.`;

async function generateSite({ name, description, style, phone, address }) {
  const desc = description || 'A local business proudly serving the community.';
  const sty = style || 'clean and modern';

  const userPrompt = `Build a Three.js landing page for: ${name}

About: ${desc}
Design vibe: ${sty}
Phone: ${phone || 'N/A'}
Address: ${address || 'N/A'}

Pick a Three.js background scene that matches the "${sty}" vibe. Make the CTA buttons bold and obvious. Keep the 3D subtle — it should enhance, not distract.`;

  if (SITE_GEN_PROVIDER === 'anthropic') {
    return callAnthropic(userPrompt);
  }
  return callDeepSeek(userPrompt);
}

// Anthropic Claude API
async function callAnthropic(userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-6',
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const raw = data.content?.[0]?.text || '';
  const html = stripCodeFences(raw);

  if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
    throw new Error('Anthropic returned invalid HTML');
  }

  return html;
}

// DeepSeek API
async function callDeepSeek(userPrompt) {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 8192,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const html = stripCodeFences(raw);

  if (!html.includes('<!DOCTYPE html>') && !html.includes('<html')) {
    throw new Error('DeepSeek returned invalid HTML');
  }

  return html;
}

function stripCodeFences(str) {
  return str
    .replace(/^```(?:html)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

module.exports = { generateSite };
