// Script to create the knowledge_graph_links table in Supabase
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Create a Supabase client with service role key
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createKnowledgeGraphLinksTable() {
  try {
    console.log('Creating knowledge_graph_links table...');

    // Read the SQL file
    const sqlPath = path.join(__dirname, '..', 'migrations', 'create_knowledge_graph_links_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Execute the SQL directly
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('Error creating knowledge_graph_links table:', error);

      // Try alternative method if RPC fails
      console.log('Attempting alternative execution method...');
      const statements = sql.split(';').filter(s => s.trim());

      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await supabase.rpc('exec_sql', {
            sql_query: statement + ';'
          });

          if (stmtError) {
            console.error('Error executing statement:', stmtError);
            throw stmtError;
          }
        }
      }
    }

    console.log('✓ Knowledge graph links table created successfully');
    console.log('✓ Indexes created');
    console.log('✓ RLS policies enabled');
    console.log('✓ Triggers configured');

    return true;
  } catch (error) {
    console.error('Error creating knowledge_graph_links table:', error);
    console.error('\nNote: If you see RPC errors, you may need to run the migration manually:');
    console.error('1. Go to Supabase Dashboard > SQL Editor');
    console.error('2. Copy the contents of migrations/create_knowledge_graph_links_table.sql');
    console.error('3. Paste and run the SQL');
    return false;
  }
}

// Run the function
createKnowledgeGraphLinksTable()
  .then(success => {
    if (success) {
      console.log('\n✓ Script completed successfully');
      process.exit(0);
    } else {
      console.error('\n✗ Script failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
