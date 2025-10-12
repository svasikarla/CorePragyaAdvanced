import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import { setupGmailClient } from '@/lib/auth/googleAuth';

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Interface for extracted email data
export interface EmailData {
  messageId: string;
  from: string;
  senderEmail: string;
  subject: string;
  urls: string[];
  timestamp: Date;
  userId?: string; // ID of the verified registered user
}

/**
 * Extract URLs from email body
 * This function finds all URLs in the email body text
 */
export const extractURLsFromBody = (body: string): string[] => {
  // More comprehensive URL regex that handles various URL formats
  const urlRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;
  
  const matches = body.match(urlRegex) || [];
  return [...new Set(matches)]; // Remove duplicates
};

/**
 * Check if a user is registered in the system
 * Returns the user ID if registered, null otherwise
 */
export const verifyRegisteredUser = async (email: string): Promise<string | null> => {
  try {
    // Look up the user in the Supabase users table
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (error || !data) {
      console.log(`User not registered: ${email}`);
      return null;
    }
    
    return data.id;
  } catch (error) {
    console.error('Error verifying user:', error);
    return null;
  }
};

/**
 * Process a single email message
 * Extracts sender information, subject, and URLs from the email body
 * Only returns data if the sender is a registered user
 */
export const processEmailMessage = async (message: any): Promise<EmailData | null> => {
  try {
    // Get Gmail client using OAuth
    const gmail = await setupGmailClient();
    
    // Get full message details
    const res = await gmail.users.messages.get({
      userId: process.env.GMAIL_USER_EMAIL, // The email we're accessing
      id: message.id,
      format: 'full',
    });
    
    const headers = res.data.payload?.headers;
    if (!headers) return null;
    
    // Extract header information
    const from = headers.find(h => h.name === 'From')?.value || '';
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const date = headers.find(h => h.name === 'Date')?.value || '';
    
    // Extract sender email from the "From" field
    const senderEmailMatch = from.match(/<([^>]+)>/) || from.match(/([^\s]+@[^\s]+)/);
    const senderEmail = senderEmailMatch ? senderEmailMatch[1] : '';
    
    // Verify if the sender is a registered user
    const userId = await verifyRegisteredUser(senderEmail);
    
    // Only proceed if the sender is a registered user
    if (!userId) {
      console.log(`Skipping email from non-registered user: ${senderEmail}`);
      return null;
    }
    
    // Get message body
    let body = '';
    
    // Handle multipart messages
    if (res.data.payload?.parts) {
      for (const part of res.data.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString();
          break;
        }
      }
    } else if (res.data.payload?.body?.data) {
      // Handle simple messages
      body = Buffer.from(res.data.payload.body.data, 'base64').toString();
    }
    
    // Extract URLs from body
    const urls = extractURLsFromBody(body);
    if (urls.length === 0) return null;
    
    return {
      messageId: message.id,
      from,
      senderEmail,
      subject,
      urls,
      timestamp: new Date(date),
      userId
    };
  } catch (error) {
    console.error('Error processing email:', error);
    return null;
  }
};

/**
 * Mark an email as read in Gmail
 */
export const markEmailAsRead = async (messageId: string): Promise<boolean> => {
  try {
    // Get Gmail client using OAuth
    const gmail = await setupGmailClient();
    
    await gmail.users.messages.modify({
      userId: process.env.GMAIL_USER_EMAIL,
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD'],
      },
    });
    return true;
  } catch (error) {
    console.error('Error marking email as read:', error);
    return false;
  }
};

/**
 * Fetch recent unread emails from wiisecase@gmail.com
 * Filter by sender email if userEmail is provided
 * Only returns emails with valid URLs
 */
export const fetchUnreadEmails = async (maxResults = 50, userEmail?: string): Promise<EmailData[]> => {
  const emails: EmailData[] = [];

  try {
    // Get Gmail client using OAuth
    const gmail = await setupGmailClient();

    // Build query string
    let query = 'is:unread';

    // Add sender filter if userEmail is provided
    if (userEmail) {
      query += ` from:${userEmail}`;
    }

    console.log(`Fetching emails with query: ${query}`);

    // Get recent unread emails
    const res = await gmail.users.messages.list({
      userId: process.env.GMAIL_USER_EMAIL,
      q: query,
      maxResults,
    });

    const messages = res.data.messages || [];
    console.log(`Found ${messages.length} unread emails`);

    for (const message of messages) {
      const emailData = await processEmailMessage(message);
      if (emailData) {
        emails.push(emailData);
      }
    }

    return emails;
  } catch (error) {
    console.error('Error fetching emails:', error);

    // Provide more specific error messages
    if (error.message.includes('invalid_grant')) {
      throw new Error('Gmail authentication expired. Please re-authenticate at /setup/gmail');
    } else if (error.message.includes('No stored tokens found')) {
      throw new Error('Gmail not connected. Please authenticate at /setup/gmail');
    } else if (error.message.includes('tokens have expired')) {
      throw new Error('Gmail tokens expired. Please re-authenticate at /setup/gmail');
    }

    throw error;
  }
};
