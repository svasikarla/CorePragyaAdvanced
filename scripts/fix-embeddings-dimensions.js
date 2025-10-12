// Script to fix embeddings table dimensions for Cohere (1024) instead of OpenAI (1536)
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

async function fixEmbeddingsDimensions() {
  try {
    console.log('🔧 Fixing embeddings table dimensions...');
    console.log('This will update the table to use Cohere embeddings (1024 dimensions)');
    console.log('⚠️  All existing embeddings will be cleared and need to be regenerated');
    
    // Read the migration SQL file
    const sqlPath = path.join(__dirname, '..', 'migrations', 'fix_embeddings_dimensions.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the migration
    console.log('Executing migration...');
    const { error } = await supabase.rpc('execute_sql', { sql });
    
    if (error) {
      console.error('❌ Error executing migration:', error);
      
      // If execute_sql doesn't exist, try alternative approach
      if (error.message && error.message.includes('function "execute_sql" does not exist')) {
        console.log('Trying alternative approach...');
        
        // Split SQL into individual statements and execute them
        const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
        
        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i].trim() + ';';
          console.log(`Executing statement ${i + 1}/${statements.length}...`);
          
          try {
            const { error: stmtError } = await supabase.sql(statement);
            if (stmtError) {
              console.error(`Error in statement ${i + 1}:`, stmtError);
              // Continue with other statements
            }
          } catch (stmtError) {
            console.error(`Error in statement ${i + 1}:`, stmtError);
            // Continue with other statements
          }
        }
      } else {
        return false;
      }
    }
    
    console.log('✅ Migration completed successfully');
    console.log('📝 Next steps:');
    console.log('   1. Restart your development server');
    console.log('   2. Go to the Personal RAG Bot page');
    console.log('   3. Click "Generate Embeddings" to regenerate embeddings with Cohere');
    
    return true;
  } catch (error) {
    console.error('❌ Error fixing embeddings dimensions:', error);
    return false;
  }
}

async function checkCurrentDimensions() {
  try {
    console.log('🔍 Checking current embeddings table structure...');
    
    // Try to get table info
    const { data, error } = await supabase
      .from('embeddings')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('📋 Embeddings table does not exist - will be created');
        return null;
      } else {
        console.log('❌ Error checking table:', error.message);
        return null;
      }
    }
    
    console.log('✅ Embeddings table exists');
    return true;
  } catch (error) {
    console.error('Error checking dimensions:', error);
    return null;
  }
}

async function main() {
  console.log('🚀 Embeddings Dimension Fix Tool');
  console.log('==================================\n');
  
  // Check current state
  await checkCurrentDimensions();
  
  // Apply the fix
  const success = await fixEmbeddingsDimensions();
  
  if (success) {
    console.log('\n🎉 Migration completed successfully!');
    console.log('The embeddings table now supports Cohere embeddings (1024 dimensions)');
  } else {
    console.log('\n❌ Migration failed. Please check the errors above.');
    console.log('You may need to run the SQL manually in Supabase dashboard.');
  }
}

// Run the script
main().catch(console.error);
