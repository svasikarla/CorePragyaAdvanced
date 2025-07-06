import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRateLimiter, checkUserQuota } from './lib/rate-limiting'

// Create a Supabase client for auth verification
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export async function middleware(request: NextRequest) {
  // Only apply rate limiting to API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    // Get the authorization header
    const authHeader = request.headers.get('Authorization')
    let userId = 'anonymous'
    
    // Extract and verify the token if available
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1]
      
      try {
        // Verify the token and get the user
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
        
        if (!error && user) {
          userId = user.id
        }
      } catch (error) {
        console.error('Auth error in middleware:', error)
      }
    }
    
    // Get the current path for endpoint-specific rate limiting
    const path = request.nextUrl.pathname
    
    // Check if the user is rate limited
    const { isLimited, remaining, limit, resetTime } = createRateLimiter(userId, path)
    
    // Check if the user has exceeded their quota (only if authenticated)
    let quotaExceeded = false
    if (userId !== 'anonymous') {
      quotaExceeded = !(await checkUserQuota(userId))
    }
    
    // Create the response with rate limit headers
    const response = NextResponse.next()
    
    // Add rate limit headers to the response
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', resetTime.toString())
    
    // If rate limited or quota exceeded, return 429 Too Many Requests
    if (isLimited || quotaExceeded) {
      const message = quotaExceeded 
        ? 'Daily API quota exceeded. Please try again tomorrow or upgrade your plan.'
        : 'Too many requests. Please try again later.'
      
      return NextResponse.json(
        { error: message },
        { 
          status: 429, 
          headers: response.headers 
        }
      )
    }
    
    return response
  }
  
  // Pass through all non-API requests
  return NextResponse.next()
}

// Update the matcher to include API routes
export const config = {
  matcher: ['/api/:path*'],
}