import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MIGRATIONS = [
  'add_latest_happenings_tables.sql',
  'add_trending_feed_columns.sql',
  'add_learning_progress_table.sql',
];

async function runMigration(projectRef, token, fileName) {
  const sqlPath = path.join(__dirname, '..', 'migrations', fileName);
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log(`\nRunning migration: ${fileName}`);

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const text = await response.text();
  console.log(`Status: ${response.status}`);
  if (response.ok) {
    console.log(`✓ ${fileName} applied successfully`);
  } else {
    console.error(`✗ ${fileName} failed:`, text);
  }
  return response.ok;
}

async function runAll() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = 'yukpehwesgzzktvoswbq';

  if (!token) {
    console.error("Missing SUPABASE_ACCESS_TOKEN in .env.local");
    process.exit(1);
  }

  console.log('Running pending migrations...');
  let success = 0;
  let failed = 0;

  for (const migration of MIGRATIONS) {
    const ok = await runMigration(projectRef, token, migration);
    if (ok) success++; else failed++;
  }

  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
}

runAll();
