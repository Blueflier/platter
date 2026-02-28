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
  * Slowly rotating geometric shapes (torus, icosahedron, octahedron, dodecahedron, box) with MeshStandardMaterial or MeshPhongMaterial
  * A drifting particle field (BufferGeometry with Points) using large point sizes (3-6px)
  * Soft animated gradient mesh (plane with shifting vertex colors)
  * Wireframe geometry with glowing edges (good for tech, tactical, modern brands)
  * Metallic floating objects — use high metalness (0.8-1.0) and low roughness (0.1-0.3) for chrome, brass, steel, gold looks
- MATCH THE MATERIAL TO THE INDUSTRY:
  * Tactical/guns/industrial: angular shapes (octahedron, dodecahedron, box), metallic materials (metalness 0.9, roughness 0.15), gunmetal/steel/brass colors, sharp slow rotations
  * Luxury/fashion/lingerie: smooth shapes (sphere, torus), glossy materials, gold/rose-gold/pearl tones
  * Food/cafe/bakery: soft rounded shapes, warm matte materials, gentle floating
  * Tech/modern: wireframe icosahedrons, cool neon accents, clean geometry
  * Spa/beauty/wellness: organic flowing shapes, soft gradients, gentle motion
- Create the renderer with { alpha: true, antialias: true }
- Set renderer.setClearColor(0x000000, 0) for transparent background
- CRITICAL LIGHTING: use STRONG lights so 3D objects are clearly visible. AmbientLight intensity 0.8+, DirectionalLight or PointLight intensity 1.5+. Add 2-3 lights with different colors.
- Mesh colors MUST complement the provided color palette — use the accent colors or harmonious tones. On dark backgrounds, meshes can be metallic, glowing, or subtly bright. On light backgrounds, use saturated colors that pop.
- Make meshes large enough to be prominent (radius 2-5, not 0.5-1)
- Animate with requestAnimationFrame, smooth rotations and gentle floating motion
- Handle window resize
- NO OrbitControls, NO post-processing
- If a 3D_MODEL_URL is provided, load it using GLTFLoader. Float and slowly rotate the loaded model as the background decoration. Apply materials from the color palette (e.g. metallic accent colors). Scale the model so it's prominent but not overwhelming. If the model fails to load, fall back to geometric shapes.
- If NO 3D_MODEL_URL is provided, use geometric shapes as described above.
- The Three.js import map (ALWAYS include addons path for GLTFLoader availability):
  <script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.158.0/build/three.module.js","three/addons/":"https://unpkg.com/three@0.158.0/examples/jsm/"}}</script>
  Then: <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; // only if model URL provided
  </script>

PAGE DESIGN — USE THE PROVIDED COLOR PALETTE:
- You will receive a color palette with: theme (dark or light), bg, text, accent, accent2.
- USE THESE EXACT COLORS. The page body background MUST be the provided bg color. Text MUST be the provided text color.
- If theme is "dark": use dark background, light text, glassmorphism cards with rgba(255,255,255,0.05-0.1) and subtle light borders. Three.js meshes should use metallic or subtly glowing materials.
- If theme is "light": use light background, dark text, glassmorphism cards with rgba(255,255,255,0.7-0.9) and soft shadows. Three.js meshes should use saturated colors that pop.
- CTA buttons should use the accent color. Secondary elements use accent2.
- Clean generous whitespace, modern typography, fluid sizing with clamp()
- Hero: large business name, one-line tagline, prominent CTA button
- About section: 2-3 sentences about the business
- Contact section: phone (click-to-call), address (Google Maps link), email if available
- CTA button in hero AND contact section (e.g. "Call Now" or "Get Directions")
- Footer: small credit "Website built by Platter" linking to https://platter.site
- Smooth scroll between sections
- AOS fade-up animations on sections

YOU ALWAYS:
- Return ONLY the complete HTML. No markdown, no code fences, no explanation.
- Start with <!DOCTYPE html> and end with </html>
- Initialize AOS at the bottom: AOS.init({ duration: 800, once: true })
- The Three.js scene MUST be clearly visible and beautiful — this is the main differentiator. If someone screenshots the page, the 3D elements should be obvious and impressive.`;

const CLASSIC_SYSTEM_PROMPT = `You are an elite creative developer who builds stunning single-page websites with beautiful CSS design. You output a single complete HTML file with all CSS and JS inline. Your sites win Awwwards nominations.

This is a CLASSIC style website — NO Three.js, NO WebGL, NO canvas. Pure HTML + CSS + minimal JS.

TECH STACK (all via CDN):
- Google Fonts (pick 1-2 fonts that match the vibe)
- AOS for section animations: https://unpkg.com/aos@2.3.1/dist/aos.css and https://unpkg.com/aos@2.3.1/dist/aos.js

HERO SECTION — THE STAR OF THE PAGE:
- Large, bold business name with striking typography (use font-size clamp for responsiveness)
- A compelling one-line tagline below the name
- Prominent CTA button(s)
- Use CSS-only design elements to make the hero visually stunning:
  * Gradient backgrounds (linear, radial, or conic gradients)
  * Subtle CSS patterns or textures (repeating-linear-gradient, dots, lines, grids)
  * Decorative shapes using CSS (circles, diagonal cuts, clip-path polygons)
  * Text effects (gradient text with background-clip, subtle text-shadow)
  * Elegant dividers or borders between sections
- The hero should feel premium and editorial — think magazine cover, not template

PAGE DESIGN — USE THE PROVIDED COLOR PALETTE:
- You will receive a color palette with: theme (dark or light), bg, text, accent, accent2.
- USE THESE EXACT COLORS. The page body background MUST be the provided bg color. Text MUST be the provided text color.
- If theme is "dark": use dark background, light text, cards with rgba(255,255,255,0.05-0.1) and subtle light borders.
- If theme is "light": use light background, dark text, cards with rgba(0,0,0,0.02-0.05) and soft shadows.
- CTA buttons should use the accent color. Secondary elements use accent2.
- Clean generous whitespace, modern typography, fluid sizing with clamp()
- Hero: large business name, one-line tagline, prominent CTA button
- About section: 2-3 sentences about the business
- Hours section: display business hours if provided, in a clean grid or list
- Contact section: phone (click-to-call), address (Google Maps link), email if available
- CTA button in hero AND contact section (e.g. "Call Now" or "Get Directions")
- Footer: small credit "Website built by Platter" linking to https://platter.site
- Smooth scroll between sections
- AOS fade-up animations on sections

DESIGN QUALITY:
- This should NOT look like a generic Bootstrap template
- Use asymmetric layouts, interesting spacing, and typographic hierarchy
- Add micro-details: hover effects on buttons (scale, color shift), smooth transitions on links
- Section transitions: diagonal cuts, curved dividers, or gradient fades between sections
- Keep it clean and professional but with enough visual flair to feel custom-designed

YOU ALWAYS:
- Return ONLY the complete HTML. No markdown, no code fences, no explanation.
- Start with <!DOCTYPE html> and end with </html>
- Initialize AOS at the bottom: AOS.init({ duration: 800, once: true })
- The design should feel like a premium, hand-crafted website — not AI-generated.`;

async function generateSite({ name, description, style, phone, address, email, business_hours, social_media_links, color_palette, model_url }) {
  const desc = description || 'A local business proudly serving the community.';
  const sty = style || 'clean and modern';
  const socialLinks = Array.isArray(social_media_links) ? social_media_links : [];
  const palette = color_palette || { theme: 'light', bg: '#fafafa', text: '#1a1a1a', accent: '#2563eb', accent2: '#6b7280' };

  const modelLine = model_url
    ? `\n3D_MODEL_URL: ${model_url}\nLoad this GLTF model with GLTFLoader and use it as the floating 3D background element. Apply accent-colored metallic materials. Add fallback geometric shapes in case the model fails to load.`
    : `\nNo 3D model provided — use geometric shapes that match the industry vibe.`;

  const userPrompt = `Build a Three.js landing page for: ${name}

About: ${desc}
Design vibe: ${sty}
Phone: ${phone || 'N/A'}
Address: ${address || 'N/A'}
Email: ${email || 'N/A'}
Business Hours: ${business_hours || 'N/A'}
Social Media: ${socialLinks.length ? socialLinks.join(', ') : 'None'}

COLOR PALETTE (use these exact colors):
- Theme: ${palette.theme}
- Background: ${palette.bg}
- Text: ${palette.text}
- Accent: ${palette.accent}
- Accent 2: ${palette.accent2}
${modelLine}

Match the 3D materials and shapes to the industry. Make the CTA buttons bold and obvious. Keep the 3D subtle — it should enhance, not distract.`;

  if (SITE_GEN_PROVIDER === 'anthropic') {
    return callAnthropic(userPrompt, SYSTEM_PROMPT);
  }
  return callDeepSeek(userPrompt, SYSTEM_PROMPT);
}

async function generateClassicSite({ name, description, style, phone, address, email, business_hours, social_media_links, color_palette }) {
  const desc = description || 'A local business proudly serving the community.';
  const sty = style || 'clean and modern';
  const socialLinks = Array.isArray(social_media_links) ? social_media_links : [];
  const palette = color_palette || { theme: 'light', bg: '#fafafa', text: '#1a1a1a', accent: '#2563eb', accent2: '#6b7280' };

  const userPrompt = `Build a classic landing page for: ${name}

About: ${desc}
Design vibe: ${sty}
Phone: ${phone || 'N/A'}
Address: ${address || 'N/A'}
Email: ${email || 'N/A'}
Business Hours: ${business_hours || 'N/A'}
Social Media: ${socialLinks.length ? socialLinks.join(', ') : 'None'}

COLOR PALETTE (use these exact colors):
- Theme: ${palette.theme}
- Background: ${palette.bg}
- Text: ${palette.text}
- Accent: ${palette.accent}
- Accent 2: ${palette.accent2}

Make the hero section striking with bold typography and CSS-only design elements. Make the CTA buttons bold and obvious. The design should feel premium and editorial.`;

  if (SITE_GEN_PROVIDER === 'anthropic') {
    return callAnthropic(userPrompt, CLASSIC_SYSTEM_PROMPT);
  }
  return callDeepSeek(userPrompt, CLASSIC_SYSTEM_PROMPT);
}

// Anthropic Claude API (with retry on 429 rate limit)
const MAX_RETRIES = 3;
async function callAnthropic(userPrompt, systemPrompt) {
  systemPrompt = systemPrompt || SYSTEM_PROMPT;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = parseInt(res.headers.get('retry-after')) || (30 * (attempt + 1));
      console.log(`Rate limited — waiting ${retryAfter}s before retry ${attempt + 1}/${MAX_RETRIES}`);
      await new Promise(r => setTimeout(r, retryAfter * 1000));
      continue;
    }

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
}

// DeepSeek API
async function callDeepSeek(userPrompt, systemPrompt) {
  systemPrompt = systemPrompt || SYSTEM_PROMPT;
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: systemPrompt },
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

module.exports = { generateSite, generateClassicSite };
