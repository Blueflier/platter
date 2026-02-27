// --- DEV A owns this file ---

const API_KEY = process.env.YUTORI_API_KEY;
const BASE_URL = 'https://api.yutori.com/v1/research';

// Create a research task for a business
async function createTask(businessName, address) {
  // TODO: Dev A implements
  // POST https://api.yutori.com/v1/research
  return { task_id: null };
}

// Poll task until completion (3s interval, 120s timeout)
async function pollTask(taskId) {
  // TODO: Dev A implements
  // GET https://api.yutori.com/v1/research/{task_id}
  return { email: null, style: null, description: null };
}

module.exports = { createTask, pollTask };
