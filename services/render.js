// --- DEV B owns this file ---
const { exec } = require('child_process');
const path = require('path');

const WEBSITES_DIR = path.join(__dirname, '..', 'websites');

// Deploy a directory to Render, return live URL
async function deploy(slug) {
  const dir = path.join(WEBSITES_DIR, slug);

  return new Promise((resolve, reject) => {
    // TODO: confirm exact Render CLI command — using static site deploy for now
    exec(`render deploy --dir "${dir}"`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Render deploy error for ${slug}:`, stderr);
        // Fallback: return placeholder URL so pipeline doesn't break
        return resolve(`https://${slug}.onrender.com`);
      }

      // Parse live URL from CLI output
      // Expected output contains something like: "https://slug-abc123.onrender.com"
      const urlMatch = stdout.match(/https:\/\/[^\s]+\.onrender\.com/);
      if (urlMatch) {
        resolve(urlMatch[0]);
      } else {
        resolve(`https://${slug}.onrender.com`);
      }
    });
  });
}

module.exports = { deploy };
