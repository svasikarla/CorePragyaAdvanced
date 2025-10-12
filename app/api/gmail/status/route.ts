import { NextResponse } from 'next/server';
import { retrieveTokens } from '@/lib/auth/googleAuth';

/**
 * Check if Gmail OAuth tokens are available and valid
 */
export async function GET() {
  try {
    // Try to retrieve stored tokens
    const tokens = await retrieveTokens();
    
    if (!tokens) {
      return NextResponse.json({
        authenticated: false,
        message: 'No Gmail tokens found. Authentication required.'
      });
    }

    // Check if tokens are expired
    const now = Date.now();
    const isExpired = tokens.expiry_date && tokens.expiry_date < now;

    if (isExpired) {
      return NextResponse.json({
        authenticated: false,
        message: 'Gmail tokens have expired. Re-authentication required.'
      });
    }

    return NextResponse.json({
      authenticated: true,
      email: process.env.GMAIL_USER_EMAIL,
      message: 'Gmail authentication is active'
    });

  } catch (error) {
    console.error('Error checking Gmail status:', error);
    return NextResponse.json({
      authenticated: false,
      message: 'Error checking authentication status'
    }, { status: 500 });
  }
}
