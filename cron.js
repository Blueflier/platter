// --- DEV A owns this file ---
require('dotenv').config();
const cron = require('node-cron');

const CATEGORIES = [
  "nail salons in San Francisco",
  "fishing shops in San Francisco"
];

// Runs daily at 9am
cron.schedule('0 9 * * *', async () => {
  console.log('Cron: starting daily pipeline...');
  for (const query of CATEGORIES) {
    try {
      await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      console.log(`Cron: kicked off search for "${query}"`);
    } catch (err) {
      console.error(`Cron: failed for "${query}"`, err.message);
    }
  }
});

console.log('Cron job scheduled — daily at 9am');
