/**
 * Verifies the tech_research_jobs table exists in Supabase.
 * If it does not, prints the SQL to run in the Supabase SQL Editor.
 *
 * Usage: node scripts/create-tech-research-table.js
 */
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing environment variables.');
  console.error('  NEXT_PUBLIC_SUPABASE_URL  :', SUPABASE_URL ? '✓ set' : '✗ MISSING');
  console.error('  SUPABASE_SERVICE_ROLE_KEY :', SERVICE_KEY ? '✓ set' : '✗ MISSING');
  console.error('\nAdd these to your .env.local file and try again.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  console.log('Checking Supabase connection...');

  // ── Step 1: Verify connection works ─────────────────────────────────────────
  const { error: pingError } = await supabase.from('knowledgebase').select('id').limit(1);
  if (pingError && pingError.code !== 'PGRST116' && pingError.code !== '42P01') {
    console.error('ERROR: Cannot connect to Supabase:', pingError.message);
    console.error('Check that NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are correct.');
    process.exit(1);
  }
  console.log('✓ Supabase connection OK');

  // ── Step 2: Check if tech_research_jobs table exists ────────────────────────
  const { error: tableError } = await supabase
    .from('tech_research_jobs')
    .select('id')
    .limit(1);

  if (!tableError || tableError.code === 'PGRST116') {
    // PGRST116 = "no rows found" — table exists but is empty. That's fine.
    console.log('✓ tech_research_jobs table already exists.');
    console.log('\nSetup complete — Technical Research Agent is ready to use.');
    process.exit(0);
  }

  if (tableError.code !== '42P01') {
    // Unexpected error (not "table does not exist")
    console.error('ERROR: Unexpected error checking table:', tableError.message);
    process.exit(1);
  }

  // ── Step 3: Table does not exist — print SQL for manual creation ─────────────
  const sqlFile = path.join(__dirname, '..', 'migrations', 'tech_research_jobs.sql');
  const sql = fs.existsSync(sqlFile) ? fs.readFileSync(sqlFile, 'utf8') : null;

  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  ACTION REQUIRED: tech_research_jobs table does not exist');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('\nThe Supabase JS client cannot create tables directly.');
  console.log('Run the migration manually in the Supabase SQL Editor:\n');
  console.log('  1. Open: https://supabase.com/dashboard/project/_/sql/new');
  console.log('  2. Paste the SQL below and click "Run"\n');
  console.log('──────────────────────────────────────────────────────────────────');
  if (sql) {
    console.log(sql);
  } else {
    console.log('(SQL file not found — see migrations/tech_research_jobs.sql)');
  }
  console.log('──────────────────────────────────────────────────────────────────');
  console.log('\nAfter running the SQL, re-run this script to confirm setup.');
  process.exit(1);
}

run().catch((err) => {
  console.error('Unhandled error:', err.message ?? err);
  process.exit(1);
});
