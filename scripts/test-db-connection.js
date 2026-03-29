import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase URL or Key in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log("Testing Supabase connection to:", supabaseUrl);
  try {
    const { data, error } = await supabase.from('knowledgebase').select('id').limit(1);
    
    // Sometimes the knowledgebase table might not exist, let's just do a generic check
    if (error && error.code === '42P01') {
       console.log("Connection successful, but knowledgebase table does not exist.");
    } else if (error) {
       console.error("Error connecting to Supabase:", error.message);
    } else {
       console.log("Connection successful! Fetched data:", data);
    }
  } catch (err) {
    console.error("Failed to connect:", err);
  }
}

testConnection();
