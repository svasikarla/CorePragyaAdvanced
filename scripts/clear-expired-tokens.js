// Script to clear expired Gmail tokens
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function clearExpiredTokens() {
  try {
    console.log('🧹 Clearing expired Gmail tokens...');
    
    // Delete expired tokens for the configured email
    const { data, error } = await supabase
      .from('gmail_tokens')
      .delete()
      .eq('email', process.env.GMAIL_USER_EMAIL);

    if (error) {
      console.error('❌ Error clearing tokens:', error);
      return;
    }

    console.log('✅ Expired tokens cleared successfully');
    console.log('📝 Next step: Visit http://localhost:3000/setup/gmail to re-authenticate');
    
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

clearExpiredTokens();
