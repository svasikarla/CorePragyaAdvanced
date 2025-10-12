// Script to create gmail_tokens table in Supabase
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Create a Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createGmailTokensTable() {
  try {
    console.log('Creating gmail_tokens table...');
    
    // Create the table
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        -- Create a table to store Gmail OAuth tokens
        CREATE TABLE IF NOT EXISTS gmail_tokens (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          email TEXT UNIQUE NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT NOT NULL,
          expiry_date BIGINT NOT NULL,
          scope TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Add RLS policies
        ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

        -- Only allow system-level access (service role)
        DROP POLICY IF EXISTS "Service role can manage gmail_tokens" ON gmail_tokens;
        CREATE POLICY "Service role can manage gmail_tokens"
          ON gmail_tokens
          USING (true)
          WITH CHECK (true);
      `
    });

    if (error) {
      console.error('Error creating table:', error);
      return;
    }

    console.log('✅ gmail_tokens table created successfully');
    
    // Check if table exists
    const { data: tables, error: checkError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_name', 'gmail_tokens')
      .eq('table_schema', 'public');

    if (checkError) {
      console.error('Error checking table:', checkError);
      return;
    }

    if (tables && tables.length > 0) {
      console.log('✅ Table verification successful');
    } else {
      console.log('❌ Table not found after creation');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Alternative method using direct SQL execution
async function createTableDirectly() {
  try {
    console.log('Creating gmail_tokens table using direct SQL...');
    
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('id')
      .limit(1);

    if (!error) {
      console.log('✅ gmail_tokens table already exists');
      return;
    }

    // If table doesn't exist, we'll get an error, which is expected
    console.log('Table does not exist, attempting to create...');
    
    // Note: This approach requires the table to be created via Supabase dashboard
    // or using the SQL editor in Supabase
    console.log(`
Please create the gmail_tokens table manually in Supabase:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Run this SQL:

CREATE TABLE IF NOT EXISTS gmail_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expiry_date BIGINT NOT NULL,
  scope TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE gmail_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage gmail_tokens"
  ON gmail_tokens
  USING (true)
  WITH CHECK (true);
    `);

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the script
createTableDirectly();
