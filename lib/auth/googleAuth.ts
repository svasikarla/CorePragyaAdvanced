import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client for token storage
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Token interface
export interface TokenData {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  scope: string;
}

/**
 * Initialize OAuth client with credentials
 */
export const setupOAuthClient = (): OAuth2Client => {
  return new OAuth2Client({
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI
  });
};

/**
 * Generate authorization URL for user consent
 */
export const getAuthUrl = (): string => {
  const oauth2Client = setupOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Force consent screen to always appear
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify'
    ]
  });
};

/**
 * Exchange authorization code for tokens
 */
export const getTokensFromCode = async (code: string): Promise<TokenData> => {
  const oauth2Client = setupOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  
  if (!tokens.access_token || !tokens.refresh_token || !tokens.expiry_date) {
    throw new Error('Invalid token response');
  }
  
  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
    scope: tokens.scope || ''
  };
};

/**
 * Store tokens in Supabase
 */
export const storeTokens = async (tokens: TokenData): Promise<void> => {
  const { error } = await supabase
    .from('gmail_tokens')
    .upsert({
      email: process.env.GMAIL_USER_EMAIL,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date,
      scope: tokens.scope
    }, {
      onConflict: 'email'
    });
  
  if (error) {
    console.error('Error storing tokens:', error);
    throw error;
  }
};

/**
 * Retrieve tokens from Supabase
 */
export const retrieveTokens = async (): Promise<TokenData | null> => {
  const { data, error } = await supabase
    .from('gmail_tokens')
    .select('*')
    .eq('email', process.env.GMAIL_USER_EMAIL)
    .single();
  
  if (error || !data) {
    console.error('Error retrieving tokens:', error);
    return null;
  }
  
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiry_date: data.expiry_date,
    scope: data.scope
  };
};

/**
 * Setup Gmail API client with OAuth credentials
 */
export const setupGmailClient = async () => {
  try {
    // Retrieve tokens from database
    const tokens = await retrieveTokens();

    if (!tokens) {
      throw new Error('No stored tokens found. User needs to authenticate.');
    }

    // Check if tokens are expired
    const now = Date.now();
    const isExpired = tokens.expiry_date && tokens.expiry_date < now;

    if (isExpired) {
      throw new Error('Gmail tokens have expired. Please re-authenticate at /setup/gmail');
    }

    const oauth2Client = setupOAuthClient();
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });

    // Set up token refresh handler
    oauth2Client.on('tokens', async (newTokens) => {
      console.log('Refreshing Gmail tokens...');
      try {
        // Update stored tokens when they're refreshed
        await storeTokens({
          access_token: newTokens.access_token || tokens.access_token,
          refresh_token: newTokens.refresh_token || tokens.refresh_token,
          expiry_date: newTokens.expiry_date || tokens.expiry_date,
          scope: newTokens.scope || tokens.scope
        });
        console.log('Gmail tokens refreshed successfully');
      } catch (error) {
        console.error('Error storing refreshed tokens:', error);
      }
    });

    // Create and return the Gmail API client
    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    console.error('Error setting up Gmail client:', error);
    throw error;
  }
};
