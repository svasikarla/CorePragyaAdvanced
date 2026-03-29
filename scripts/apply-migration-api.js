import fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function runSql() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = 'yukpehwesgzzktvoswbq';

  if (!token) {
    console.error("Missing SUPABASE_ACCESS_TOKEN in .env.local");
    return;
  }

  const sqlPath = path.join(__dirname, '..', 'migrations', 'add_latest_happenings_tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log("Executing SQL migration via Supabase Management API...");

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });
  
  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text);
}

runSql();
