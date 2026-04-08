/**
 * apply-migrations.js
 *
 * Applies SQL migration files to Supabase using the Management API.
 *
 * Required env vars (in .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL   — e.g. https://abcdef.supabase.co
 *   SUPABASE_ACCESS_TOKEN      — personal access token from
 *                                https://supabase.com/dashboard/account/tokens
 *
 * Usage:
 *   node scripts/apply-migrations.js                        # apply all migrations
 *   node scripts/apply-migrations.js add_trending_feed      # apply matching file(s)
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

require('dotenv').config({ path: '.env.local' });

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ACCESS_TOKEN      = process.env.SUPABASE_ACCESS_TOKEN    || '';
const MIGRATIONS_DIR    = path.join(__dirname, '..', 'migrations');

// Derive project ref from the Supabase URL (e.g. "abcdefghijk" from "https://abcdefghijk.supabase.co")
function getProjectRef(url) {
  try {
    const hostname = new URL(url).hostname;       // abcdefghijk.supabase.co
    return hostname.split('.')[0];                // abcdefghijk
  } catch {
    return null;
  }
}

// ─── Management API call ──────────────────────────────────────────────────────

/**
 * Execute arbitrary SQL via the Supabase Management API.
 * @param {string} projectRef
 * @param {string} sql
 * @returns {Promise<{ok: boolean, body: any}>}
 */
function execSQL(projectRef, sql) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ query: sql });

    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${projectRef}/database/query`,
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let body;
        try { body = JSON.parse(data); } catch { body = data; }
        resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body });
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Migration runner ─────────────────────────────────────────────────────────

async function applyMigration(projectRef, filePath) {
  const name = path.basename(filePath);
  console.log(`\nApplying: ${name}`);

  const sql = fs.readFileSync(filePath, 'utf8').trim();
  if (!sql) {
    console.log('  (empty file, skipping)');
    return true;
  }

  const { ok, status, body } = await execSQL(projectRef, sql);

  if (!ok) {
    const msg = body?.message || body?.error || JSON.stringify(body);
    console.error(`  ✗ Failed (HTTP ${status}): ${msg}`);
    return false;
  }

  console.log(`  ✓ Applied successfully`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Validate env
  if (!SUPABASE_URL) {
    console.error('Error: NEXT_PUBLIC_SUPABASE_URL is not set in .env.local');
    process.exit(1);
  }

  const projectRef = getProjectRef(SUPABASE_URL);
  if (!projectRef) {
    console.error(`Error: Could not derive project ref from URL: ${SUPABASE_URL}`);
    process.exit(1);
  }

  if (!ACCESS_TOKEN) {
    console.error(`
Error: SUPABASE_ACCESS_TOKEN is not set in .env.local

To get your token:
  1. Go to https://supabase.com/dashboard/account/tokens
  2. Click "Generate new token"
  3. Add it to .env.local as:
     SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

Then re-run: node scripts/apply-migrations.js
`);
    process.exit(1);
  }

  console.log(`Project ref : ${projectRef}`);
  console.log(`Migrations  : ${MIGRATIONS_DIR}`);

  // Collect files
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error('Error: migrations/ directory not found');
    process.exit(1);
  }

  const filter = process.argv[2] || '';           // optional file name filter

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql') && (!filter || f.includes(filter)))
    .sort()                                        // alphabetical / version order
    .map(f => path.join(MIGRATIONS_DIR, f));

  if (files.length === 0) {
    console.log(filter
      ? `No migration files matching "${filter}" found`
      : 'No migration files found');
    process.exit(0);
  }

  console.log(`\nFound ${files.length} file(s) to apply:`);
  files.forEach(f => console.log(`  - ${path.basename(f)}`));

  let failed = 0;
  for (const file of files) {
    const ok = await applyMigration(projectRef, file);
    if (!ok) failed++;
  }

  console.log('');
  if (failed > 0) {
    console.error(`${failed} migration(s) failed.`);
    process.exit(1);
  } else {
    console.log(`All ${files.length} migration(s) applied successfully.`);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
