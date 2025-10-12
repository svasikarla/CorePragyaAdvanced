// Comprehensive Gmail OAuth Diagnostic Script
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnoseGmailOAuth() {
  console.log('🔍 Gmail OAuth Diagnostic Report');
  console.log('================================\n');

  // 1. Check Environment Variables
  console.log('1. Environment Variables:');
  console.log(`   GMAIL_CLIENT_ID: ${process.env.GMAIL_CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`   GMAIL_CLIENT_SECRET: ${process.env.GMAIL_CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`   GMAIL_REDIRECT_URI: ${process.env.GMAIL_REDIRECT_URI || '❌ Missing'}`);
  console.log(`   GMAIL_USER_EMAIL: ${process.env.GMAIL_USER_EMAIL || '❌ Missing'}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? (process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here' ? '❌ Placeholder' : '✅ Set') : '❌ Missing'}`);
  console.log();

  // 2. Check Supabase Connection
  console.log('2. Supabase Connection:');
  try {
    const { data, error } = await supabase.from('gmail_tokens').select('count').single();
    if (error && error.code === 'PGRST116') {
      console.log('   ❌ gmail_tokens table does not exist');
    } else if (error) {
      console.log(`   ❌ Supabase error: ${error.message}`);
    } else {
      console.log('   ✅ Supabase connection successful');
    }
  } catch (err) {
    console.log(`   ❌ Supabase connection failed: ${err.message}`);
  }
  console.log();

  // 3. Check Gmail Tokens Table
  console.log('3. Gmail Tokens Table:');
  try {
    const { data, error } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('email', process.env.GMAIL_USER_EMAIL);

    if (error) {
      console.log(`   ❌ Error querying tokens: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.log('   ❌ No tokens found for wiisecache@gmail.com');
      console.log('   📝 Action needed: Complete OAuth flow');
    } else {
      const token = data[0];
      console.log('   ✅ Tokens found');
      console.log(`   📅 Created: ${token.created_at}`);
      console.log(`   📅 Updated: ${token.updated_at}`);
      
      // Check if tokens are expired
      const now = Date.now();
      const isExpired = token.expiry_date && token.expiry_date < now;
      console.log(`   ⏰ Expired: ${isExpired ? '❌ Yes' : '✅ No'}`);
      
      if (isExpired) {
        console.log('   📝 Action needed: Tokens expired, re-authentication required');
      }
    }
  } catch (err) {
    console.log(`   ❌ Error checking tokens: ${err.message}`);
  }
  console.log();

  // 4. Test OAuth Client Setup
  console.log('4. OAuth Client Setup:');
  try {
    const oauth2Client = new google.auth.OAuth2({
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      redirectUri: process.env.GMAIL_REDIRECT_URI
    });
    console.log('   ✅ OAuth2Client created successfully');
    
    // Generate auth URL to test configuration
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ]
    });
    console.log('   ✅ Auth URL generation successful');
    console.log(`   🔗 Auth URL: ${authUrl.substring(0, 100)}...`);
  } catch (err) {
    console.log(`   ❌ OAuth client setup failed: ${err.message}`);
  }
  console.log();

  // 5. Test Gmail API Access (if tokens exist)
  console.log('5. Gmail API Access Test:');
  try {
    const { data: tokenData } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('email', process.env.GMAIL_USER_EMAIL)
      .single();

    if (!tokenData) {
      console.log('   ⏭️  Skipped - No tokens available');
    } else {
      const oauth2Client = new google.auth.OAuth2({
        clientId: process.env.GMAIL_CLIENT_ID,
        clientSecret: process.env.GMAIL_CLIENT_SECRET,
        redirectUri: process.env.GMAIL_REDIRECT_URI
      });

      oauth2Client.setCredentials({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expiry_date: tokenData.expiry_date
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      
      // Test API call
      const res = await gmail.users.getProfile({
        userId: process.env.GMAIL_USER_EMAIL
      });
      
      console.log('   ✅ Gmail API access successful');
      console.log(`   📧 Email: ${res.data.emailAddress}`);
      console.log(`   📊 Total messages: ${res.data.messagesTotal}`);
    }
  } catch (err) {
    console.log(`   ❌ Gmail API access failed: ${err.message}`);
    if (err.message.includes('invalid_grant')) {
      console.log('   📝 This is the root cause of your error!');
    }
  }
  console.log();

  // 6. Recommendations
  console.log('6. Recommendations:');
  
  if (process.env.ANTHROPIC_API_KEY === 'your_anthropic_api_key_here') {
    console.log('   🔧 Replace placeholder ANTHROPIC_API_KEY with actual key');
  }
  
  try {
    const { data: tokenData } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('email', process.env.GMAIL_USER_EMAIL)
      .single();

    if (!tokenData) {
      console.log('   🔧 Complete OAuth flow: Visit http://localhost:3000/setup/gmail');
    } else {
      const now = Date.now();
      const isExpired = tokenData.expiry_date && tokenData.expiry_date < now;
      if (isExpired) {
        console.log('   🔧 Re-authenticate: Tokens expired, visit http://localhost:3000/setup/gmail');
      } else {
        console.log('   ✅ OAuth setup appears correct');
        console.log('   🔧 If still getting errors, try refreshing tokens');
      }
    }
  } catch (err) {
    console.log('   🔧 Complete OAuth flow: Visit http://localhost:3000/setup/gmail');
  }
  
  console.log('\n================================');
  console.log('Diagnostic complete! 🏁');
}

// Run the diagnostic
diagnoseGmailOAuth().catch(console.error);
