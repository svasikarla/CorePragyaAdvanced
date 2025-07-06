import { createClient } from '@supabase/supabase-js';
import LRUCache from 'lru-cache';

// Create a Supabase client for admin operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory cache for rate limiting
// This helps reduce database calls and provides faster rate limiting
const rateLimitCache = new LRUCache<string, number[]>({
  max: 5000, // Maximum number of users to track
  ttl: 60 * 1000, // Cache TTL: 1 minute
});

// Cost factors for different AI models
const MODEL_COST_FACTORS: Record<string, { input: number; output: number }> = {
  // OpenAI models (legacy)
  'gpt-4o': { input: 0.00001, output: 0.00003 }, // $10/1M input, $30/1M output
  'gpt-4': { input: 0.00003, output: 0.00006 },  // $30/1M input, $60/1M output
  'text-embedding-3-small': { input: 0.000001, output: 0 }, // $1/1M tokens
  'text-embedding-3-large': { input: 0.000002, output: 0 }, // $2/1M tokens

  // Anthropic Claude models
  'claude-3-5-sonnet': { input: 0.000006, output: 0.00003 }, // $6/1M input, $30/1M output
  'claude-3-opus': { input: 0.000015, output: 0.000075 }, // $15/1M input, $75/1M output
  'claude-3-haiku': { input: 0.00000025, output: 0.00000125 }, // $0.25/1M input, $1.25/1M output

  // Cohere models
  'embed-english-v3.0': { input: 0.0000001, output: 0 }, // $0.1/1M tokens

  'default': { input: 0.000005, output: 0.000015 }, // Default fallback
};

// Endpoints and their default rate limits
const ENDPOINT_LIMITS: Record<string, { windowMs: number; maxRequests: number }> = {
  '/api/rag-search': { windowMs: 60 * 1000, maxRequests: 20 }, // 20 requests per minute
  '/api/process-url': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 requests per minute
  '/api/generate-embeddings': { windowMs: 60 * 1000, maxRequests: 15 }, // 15 requests per minute
  '/api/refresh-from-email': { windowMs: 60 * 1000, maxRequests: 5 }, // 5 requests per minute
  '/api/process-pdf': { windowMs: 60 * 1000, maxRequests: 10 }, // 10 requests per minute
  'default': { windowMs: 60 * 1000, maxRequests: 30 }, // Default fallback
};

/**
 * Create a rate limiter for a specific endpoint
 * @param userId User ID to check
 * @param endpoint API endpoint being accessed
 * @returns Object with isLimited flag and rate limit info
 */
export function createRateLimiter(userId: string, endpoint: string): {
  isLimited: boolean;
  remaining: number;
  limit: number;
  resetTime: number;
} {
  // Get endpoint configuration or use default
  const config = ENDPOINT_LIMITS[endpoint] || ENDPOINT_LIMITS['default'];
  const { windowMs, maxRequests } = config;

  // Current timestamp
  const now = Date.now();

  // Create a unique key for this user and endpoint
  const cacheKey = `${userId}:${endpoint}`;

  // Get current requests from cache or initialize new array
  let requests = rateLimitCache.get(cacheKey) || [];

  // Filter out requests outside the current window
  requests = requests.filter((timestamp: number) => now - timestamp < windowMs);

  // Check if user has exceeded the rate limit
  const isLimited = requests.length >= maxRequests;

  // Calculate remaining requests
  const remaining = Math.max(0, maxRequests - requests.length);

  // Calculate reset time (when the oldest request will expire)
  const resetTime = requests.length > 0
    ? requests[0] + windowMs
    : now + windowMs;

  // If not limited, add the current request to the cache
  if (!isLimited) {
    requests.push(now);
    rateLimitCache.set(cacheKey, requests);
  }

  return {
    isLimited,
    remaining,
    limit: maxRequests,
    resetTime
  };
}

/**
 * Record token usage in the database
 * @param userId User ID
 * @param endpoint API endpoint used
 * @param model OpenAI model used
 * @param inputTokens Number of input tokens
 * @param outputTokens Number of output tokens
 */
export async function recordTokenUsage(
  userId: string,
  endpoint: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    // Calculate cost based on model and tokens
    const costFactor = MODEL_COST_FACTORS[model] || MODEL_COST_FACTORS['default'];
    const cost = (inputTokens * costFactor.input) + (outputTokens * costFactor.output);

    // Record usage in the database
    await supabaseAdmin
      .from('api_usage')
      .insert({
        user_id: userId,
        endpoint,
        tokens_used: inputTokens + outputTokens,
        cost
      });
  } catch (error) {
    console.error('Error recording API usage:', error);
    // Don't throw - this should not block the main request
  }
}

/**
 * Check if a user has exceeded their quota
 * @param userId User ID to check
 * @returns Boolean indicating if the user has quota remaining
 */
export async function checkUserQuota(userId: string): Promise<boolean> {
  try {
    // Call the database function to check quota
    const { data, error } = await supabaseAdmin.rpc('check_daily_quota', {
      user_uuid: userId
    });

    if (error) {
      console.error('Error checking quota:', error);
      return true; // Default to allowing the request if there's an error
    }

    return data as boolean;
  } catch (error) {
    console.error('Error in quota check:', error);
    return true; // Default to allowing the request if there's an error
  }
}

/**
 * Get user's current usage statistics
 * @param userId User ID
 * @returns Usage statistics
 */
export async function getUserUsageStats(userId: string): Promise<{
  dailyUsage: number;
  monthlyUsage: number;
  dailyLimit: number;
  monthlyLimit: number;
}> {
  try {
    // Get daily usage
    const { data: dailyData } = await supabaseAdmin
      .from('daily_api_usage')
      .select('request_count')
      .eq('user_id', userId)
      .eq('usage_date', new Date().toISOString().split('T')[0])
      .single();

    // Get monthly usage
    const { data: monthlyData } = await supabaseAdmin
      .from('monthly_api_usage')
      .select('request_count')
      .eq('user_id', userId)
      .eq('usage_month', new Date().toISOString().substring(0, 7))
      .single();

    // Get user's quota limits
    const { data: quotaData } = await supabaseAdmin
      .from('api_quotas')
      .select('daily_limit, monthly_limit')
      .eq('user_id', userId)
      .single();

    return {
      dailyUsage: dailyData?.request_count || 0,
      monthlyUsage: monthlyData?.request_count || 0,
      dailyLimit: quotaData?.daily_limit || 100,
      monthlyLimit: quotaData?.monthly_limit || 2000
    };
  } catch (error) {
    console.error('Error getting usage stats:', error);
    return {
      dailyUsage: 0,
      monthlyUsage: 0,
      dailyLimit: 100,
      monthlyLimit: 2000
    };
  }
}