import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

const { mockGetUser, mockFrom, mockCreateCompletion, mockGetLLMProvider, mockGetModelForProvider, mockGetFeedsForCategories } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockCreateCompletion: vi.fn(),
  mockGetLLMProvider: vi.fn(),
  mockGetModelForProvider: vi.fn((m: string) => m),
  mockGetFeedsForCategories: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock('@/lib/ai-clients', () => ({
  getLLMProvider: mockGetLLMProvider,
  getModelForProvider: mockGetModelForProvider,
}));

vi.mock('@/lib/interest-profile', () => ({
  getUserInterestProfile: vi.fn().mockResolvedValue({
    categories: [{ name: 'AI', weight: 5 }, { name: 'Science', weight: 3 }],
    recentSummaries: ['summary1'],
    topKeywords: ['AI', 'Science'],
  }),
}));

vi.mock('@/lib/default-feeds', () => ({
  DEFAULT_FEED_CATALOG: [
    { name: 'Feed1', url: 'http://feed1.com/rss', category: 'AI', description: 'AI feed' },
    { name: 'Feed2', url: 'http://feed2.com/rss', category: 'Science', description: 'Science feed' },
  ],
  getFeedsForCategories: mockGetFeedsForCategories,
}));

function mockSupabaseChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.neq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return chain;
}

function makeRequest(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request('http://localhost/api/suggest-feeds', {
    method: 'GET',
    headers,
  });
}

describe('Suggest Feeds API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLLMProvider.mockReturnValue({ createCompletion: mockCreateCompletion });
  });

  it('returns 401 when no Authorization header', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Missing authorization');
  });

  it('returns 401 when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('bad') });

    const res = await GET(makeRequest('bad'));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns catalog suggestions when enough matches exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    // No existing subscriptions
    mockFrom.mockReturnValue(mockSupabaseChain({ data: [], error: null }));

    // Catalog has enough feeds
    const catalogFeeds = Array.from({ length: 6 }, (_, i) => ({
      name: `Feed ${i}`,
      url: `http://feed${i}.com/rss`,
      category: 'AI',
      description: `Feed ${i} desc`,
    }));
    mockGetFeedsForCategories.mockReturnValue(catalogFeeds);

    const res = await GET(makeRequest('valid'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.suggestions).toHaveLength(6);
    expect(body.suggestions[0].source).toBe('catalog');
    // LLM should not be called since catalog had enough
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it('supplements with LLM suggestions when catalog has fewer than 6', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue(mockSupabaseChain({ data: [], error: null }));

    // Only 2 catalog matches
    mockGetFeedsForCategories.mockReturnValue([
      { name: 'Feed1', url: 'http://feed1.com/rss', category: 'AI', description: 'AI feed' },
      { name: 'Feed2', url: 'http://feed2.com/rss', category: 'Science', description: 'Science feed' },
    ]);

    // LLM returns 4 more
    mockCreateCompletion.mockResolvedValue({
      content: JSON.stringify([
        { name: 'LLM Feed 1', url: 'http://llm1.com/rss', description: 'LLM rec 1', category: 'AI' },
        { name: 'LLM Feed 2', url: 'http://llm2.com/rss', description: 'LLM rec 2', category: 'AI' },
        { name: 'LLM Feed 3', url: 'http://llm3.com/rss', description: 'LLM rec 3', category: 'Science' },
        { name: 'LLM Feed 4', url: 'http://llm4.com/rss', description: 'LLM rec 4', category: 'Science' },
      ]),
    });

    const res = await GET(makeRequest('valid'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.suggestions).toHaveLength(6);
    // First 2 from catalog, remaining from AI
    expect(body.suggestions[0].source).toBe('catalog');
    expect(body.suggestions[1].source).toBe('catalog');
    expect(body.suggestions[2].source).toBe('ai');
  });

  it('excludes already-subscribed feeds from suggestions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    // User already subscribes to feed1
    mockFrom.mockReturnValue(mockSupabaseChain({
      data: [{ rss_feeds: { url: 'http://feed1.com/rss' } }],
      error: null,
    }));

    mockGetFeedsForCategories.mockReturnValue([
      { name: 'Feed1', url: 'http://feed1.com/rss', category: 'AI', description: 'AI feed' },
      { name: 'Feed2', url: 'http://feed2.com/rss', category: 'Science', description: 'Science feed' },
    ]);

    mockCreateCompletion.mockResolvedValue({
      content: JSON.stringify([
        { name: 'LLM Feed 1', url: 'http://llm1.com/rss', description: 'LLM rec', category: 'AI' },
      ]),
    });

    const res = await GET(makeRequest('valid'));
    const body = await res.json();

    // Feed1 should be excluded since user already subscribes to it
    const urls = body.suggestions.map((s: any) => s.url);
    expect(urls).not.toContain('http://feed1.com/rss');
    expect(urls).toContain('http://feed2.com/rss');
  });

  it('returns hardcoded fallbacks when catalog and LLM both return nothing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue(mockSupabaseChain({ data: [], error: null }));

    // No catalog matches
    mockGetFeedsForCategories.mockReturnValue([]);

    // LLM fails
    mockCreateCompletion.mockRejectedValue(new Error('LLM unavailable'));

    const res = await GET(makeRequest('valid'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.suggestions.length).toBeGreaterThan(0);
    // Fallback feeds should include TechCrunch or The Verge
    const names = body.suggestions.map((s: any) => s.name);
    expect(names.some((n: string) => n === 'TechCrunch' || n === 'The Verge')).toBe(true);
  });

  it('handles LLM returning unparseable content gracefully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue(mockSupabaseChain({ data: [], error: null }));

    mockGetFeedsForCategories.mockReturnValue([
      { name: 'Feed1', url: 'http://feed1.com/rss', category: 'AI', description: 'AI feed' },
    ]);

    // LLM returns garbage
    mockCreateCompletion.mockResolvedValue({ content: 'not json at all' });

    const res = await GET(makeRequest('valid'));
    const body = await res.json();

    // Should still succeed with just the catalog result
    expect(res.status).toBe(200);
    expect(body.suggestions.length).toBeGreaterThanOrEqual(1);
  });
});
