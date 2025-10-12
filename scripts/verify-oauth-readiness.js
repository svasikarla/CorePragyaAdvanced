// Script to verify OAuth readiness
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyOAuthReadiness() {
  console.log('🔍 OAuth Readiness Verification');
  console.log('==============================\n');

  let allGood = true;

  // 1. Check Environment Variables
  console.log('1. Environment Variables:');
  const requiredEnvVars = [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET', 
    'GMAIL_REDIRECT_URI',
    'GMAIL_USER_EMAIL'
  ];

  for (const envVar of requiredEnvVars) {
    const value = process.env[envVar];
    if (value) {
      console.log(`   ✅ ${envVar}: Set`);
    } else {
      console.log(`   ❌ ${envVar}: Missing`);
      allGood = false;
    }
  }
  console.log();

  // 2. Check Database Tables
  console.log('2. Database Tables:');
  try {
    // Check gmail_tokens table
    const { data: tokensData, error: tokensError } = await supabase
      .from('gmail_tokens')
      .select('count')
      .limit(1);
    
    if (tokensError) {
      console.log(`   ❌ gmail_tokens table: ${tokensError.message}`);
      allGood = false;
    } else {
      console.log('   ✅ gmail_tokens table: Accessible');
    }

    // Check users table
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    if (usersError) {
      console.log(`   ❌ users table: ${usersError.message}`);
      allGood = false;
    } else {
      console.log('   ✅ users table: Accessible');
    }
  } catch (err) {
    console.log(`   ❌ Database connection: ${err.message}`);
    allGood = false;
  }
  console.log();

  // 3. Check User Registration
  console.log('3. User Registration:');
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', 'satish_vasi@yahoo.com')
      .single();

    if (userError || !userData) {
      console.log('   ❌ satish_vasi@yahoo.com: Not registered');
      allGood = false;
    } else {
      console.log('   ✅ satish_vasi@yahoo.com: Registered');
      console.log(`      ID: ${userData.id}`);
      console.log(`      Name: ${userData.name}`);
    }
  } catch (err) {
    console.log(`   ❌ User check failed: ${err.message}`);
    allGood = false;
  }
  console.log();

  // 4. Check OAuth Tokens Status
  console.log('4. OAuth Tokens Status:');
  try {
    const { data: tokenData, error: tokenError } = await supabase
      .from('gmail_tokens')
      .select('*')
      .eq('email', process.env.GMAIL_USER_EMAIL);

    if (tokenError) {
      console.log(`   ❌ Token query failed: ${tokenError.message}`);
      allGood = false;
    } else if (!tokenData || tokenData.length === 0) {
      console.log('   ❌ No OAuth tokens found');
      console.log('   📝 This is the ROOT CAUSE of the error');
      allGood = false;
    } else {
      console.log('   ✅ OAuth tokens found');
      const token = tokenData[0];
      const isExpired = token.expiry_date && token.expiry_date < Date.now();
      console.log(`   ⏰ Expired: ${isExpired ? 'Yes' : 'No'}`);
      if (isExpired) allGood = false;
    }
  } catch (err) {
    console.log(`   ❌ Token check failed: ${err.message}`);
    allGood = false;
  }
  console.log();

  // 5. Final Assessment
  console.log('5. Final Assessment:');
  if (allGood) {
    console.log('   ✅ All systems ready - OAuth should work');
  } else {
    console.log('   ❌ Issues found - OAuth will fail');
    console.log('   🔧 Primary action needed: Complete OAuth flow at /setup/gmail');
  }
  console.log();

  console.log('==============================');
  console.log(`Result: ${allGood ? '✅ READY' : '❌ NOT READY'}`);
}

verifyOAuthReadiness().catch(console.error);
