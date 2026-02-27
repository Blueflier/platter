// --- DEV B owns this file ---
// Site generation via DeepSeek (HTML) + Pioneer (light tasks)

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const PIONEER_API_KEY = process.env.PIONEER_API_KEY;
const PIONEER_ENDPOINT = process.env.PIONEER_ENDPOINT;
const PIONEER_MODEL_ID = process.env.PIONEER_MODEL_ID;

const SYSTEM_PROMPT = `You are an elite frontend developer who builds stunning, award-winning single-page websites. You write a single complete HTML file with all CSS and JS inline. Your sites look like they were designed by a top agency.

Design principles you follow:
- Clean, generous whitespace and modern typography (Google Fonts via CDN)
- Smooth scroll-triggered animations using AOS (Animate On Scroll) library via CDN
- Subtle gradient backgrounds and glassmorphism accents
- Mobile-first responsive design with fluid typography (clamp)
- High contrast text, accessible color choices
- Elegant hover states and transitions on interactive elements
- A clear visual hierarchy: hero, about, contact, footer
- Professional micro-interactions (button hover scales, smooth scrolls)

CDN libraries you include in every site:
- Google Fonts (pick 1-2 fonts that match the style)
- AOS: https://unpkg.com/aos@2.3.1/dist/aos.css and https://unpkg.com/aos@2.3.1/dist/aos.js

You ALWAYS:
- Return ONLY the complete HTML. No markdown, no explanation, no code fences.
- Start with <!DOCTYPE html> and end with </html>
- Initialize AOS at the bottom: AOS.init({ duration: 800, once: true })
- Use semantic HTML (header, main, section, footer)
- Include a click-to-call link for the phone number
- Include a Google Maps link for the address
- Add a "Website built by Platter" credit in the footer with a link to https://platter.site`;

// Generate landing page HTML via DeepSeek
async function generateSite({ name, description, style, phone, address }) {
  const desc = description || 'A local business proudly serving the community.';
  const sty = style || 'clean and modern';

  const userPrompt = `Build a landing page for: ${name}

About: ${desc}
Design style: ${sty}
Phone: ${phone || 'N/A'}
Address: ${address || 'N/A'}

Sections: hero with business name and tagline, about/description, contact info, footer. Pick a color palette that matches "${sty}". Make it feel premium.`;

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
      max_tokens: 8000,
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

// Strip markdown code fences if model wraps output
function stripCodeFences(str) {
  return str
    .replace(/^```(?:html)?\s*\n?/i, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

module.exports = { generateSite };
