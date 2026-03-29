import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
  const { data: kbData } = await supabase.from('knowledgebase').select('id, category, source_type');
  
  if (!kbData) {
    console.log("No KB Data");
    return;
  }

  const manualCats = new Set();
  const rssCats = new Set();
  let rssCount = 0;
  let manualCount = 0;

  kbData.forEach(item => {
    if (item.source_type === 'rss') {
      rssCount++;
      rssCats.add(item.category);
    } else {
      manualCount++;
      manualCats.add(item.category);
    }
  });

  console.log(`Manual entries: ${manualCount}`);
  console.log(`Manual categories:`, Array.from(manualCats));
  console.log(`RSS entries: ${rssCount}`);
  console.log(`RSS categories:`, Array.from(rssCats));
}

checkData();
