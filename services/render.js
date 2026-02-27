// --- DEV B owns this file ---
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const RENDER_OWNER_ID = process.env.RENDER_OWNER_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_SITES_REPO = process.env.GITHUB_SITES_REPO;

const REPO_DIR = path.join(__dirname, '..', '.sites-repo');

// Clone or pull the platter-sites GitHub repo
function ensureRepo() {
  const remote = `https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_SITES_REPO}.git`;

  if (!fs.existsSync(path.join(REPO_DIR, '.git'))) {
    execSync(`git clone "${remote}" "${REPO_DIR}"`, { stdio: 'pipe' });
  } else {
    // Update remote URL in case token rotated
    execSync(`git remote set-url origin "${remote}"`, { cwd: REPO_DIR, stdio: 'pipe' });
    try {
      execSync('git pull origin main', { cwd: REPO_DIR, stdio: 'pipe' });
    } catch {
      // Empty repo or no main branch yet — that's fine on first push
    }
  }

  // Ensure git identity for commits
  try {
    execSync('git config user.email', { cwd: REPO_DIR, stdio: 'pipe' });
  } catch {
    execSync('git config user.email "deploy@platter.site"', { cwd: REPO_DIR, stdio: 'pipe' });
    execSync('git config user.name "Platter Deploy"', { cwd: REPO_DIR, stdio: 'pipe' });
  }
}

// Write HTML into the sites repo, commit, and push
function pushToGitHub(slug, html) {
  ensureRepo();

  const siteDir = path.join(REPO_DIR, 'sites', slug);
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(path.join(siteDir, 'index.html'), html);

  execSync('git add -A', { cwd: REPO_DIR, stdio: 'pipe' });

  // Check if there's anything to commit
  try {
    execSync('git diff --cached --quiet', { cwd: REPO_DIR, stdio: 'pipe' });
    // No changes — already pushed this exact content
    return;
  } catch {
    // There are staged changes — commit them
  }

  execSync(`git commit -m "Add site: ${slug}"`, { cwd: REPO_DIR, stdio: 'pipe' });

  // Ensure branch is named main (needed for first push on empty repos)
  try {
    execSync('git branch -M main', { cwd: REPO_DIR, stdio: 'pipe' });
  } catch { /* already on main */ }

  execSync('git push -u origin main', { cwd: REPO_DIR, stdio: 'pipe' });
}

// Create a Render static site service via API, return the live URL
async function createRenderService(slug) {
  const res = await fetch('https://api.render.com/v1/services', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'static_site',
      name: `platter-${slug}`,
      ownerId: RENDER_OWNER_ID,
      repo: `https://github.com/${GITHUB_SITES_REPO}`,
      branch: 'main',
      rootDir: `sites/${slug}`,
      autoDeploy: 'yes',
      serviceDetails: {
        buildCommand: '',
        publishPath: '.',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Render API error (${res.status}): ${err}`);
  }

  const data = await res.json();

  // The API returns the service object with its onrender.com URL
  const url =
    data.service?.serviceDetails?.url ||
    data.serviceDetails?.url ||
    data.url ||
    `https://platter-${slug}.onrender.com`;

  return url;
}

// Trigger a redeploy for an existing Render service
async function triggerDeploy(serviceId) {
  const res = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RENDER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Render deploy trigger error (${res.status}): ${err}`);
  }

  return res.json();
}

// Main entry point: push HTML to GitHub → create Render static site → return URL
async function deploy(slug, html) {
  // 1. Push generated HTML to the GitHub sites repo
  pushToGitHub(slug, html);

  // 2. Create a new Render static site for this slug
  const liveUrl = await createRenderService(slug);

  console.log(`Deployed ${slug} → ${liveUrl}`);
  return liveUrl;
}

module.exports = { deploy, triggerDeploy };
