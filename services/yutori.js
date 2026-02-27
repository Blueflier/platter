// --- DEV A owns this file ---
// Yutori API: POST/GET https://api.yutori.com/v1/research/tasks, header X-API-Key

const API_KEY = process.env.YUTORI_API_KEY;
const BASE_URL = 'https://api.yutori.com/v1/research/tasks';
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;

function buildQuery(businessName, address) {
  return `Research '${businessName}' at ${address}. Find: any email address, social media links, description of the business vibe. Then suggest a visual website style (e.g. 'modern minimalist', 'warm and luxurious', 'clean and clinical') based on what you find.`;
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

// Parse Yutori result text into email, style, description (best-effort)
function parseResult(text) {
  if (!text || typeof text !== 'string') {
    return { email: null, style: null, description: null };
  }
  const t = text.trim();
  // Heuristic: look for email pattern
  const emailMatch = t.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  const email = emailMatch ? emailMatch[0] : null;
  // Style often appears after "style" or similar
  let style = null;
  const styleMatch = t.match(/(?:style|visual style|suggest.*?)(?::| -|—)\s*["']?([^."'\n]+)/i) ||
    t.match(/(?:modern minimalist|warm and luxurious|clean and clinical|[a-z]+ and [a-z]+)/i);
  if (styleMatch) style = (styleMatch[1] || styleMatch[0]).trim();
  // First 1-2 sentences as description
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  const description = sentences.slice(0, 2).join(' ').trim() || t.slice(0, 200);
  return { email, style, description };
}

// Poll task until completion (3s interval, 120s timeout)
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
      return parseResult(raw);
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(task.error_message || task.message || 'Yutori task failed');
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error('Yutori poll timeout');
}

module.exports = { createTask, pollTask };
