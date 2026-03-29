import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

function mockSupabaseChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.ilike = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return chain;
}

function makeRequest(params = '', token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request(`http://localhost/api/trending-feed${params ? '?' + params : ''}`, {
    method: 'GET',
    headers,
  });
}

describe('Trending Feed API - GET', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no Authorization header', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('bad') });

    const res = await GET(makeRequest('', 'bad-token'));
    const body = await res.json();
    expect(res.status).toBe(401);
  });

  it('returns empty articles when user has no KB entries', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue(mockSupabaseChain({ data: [], error: null }));

    const res = await GET(makeRequest('', 'valid'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.articles).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.has_more).toBe(false);
  });

  it('returns articles sorted by composite score', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    mockFrom.mockReturnValue(mockSupabaseChain({
      data: [
        {
          id: 'a1', title: 'Old High Score', summary_text: 'Summary 1', source_ref: 'http://a.com',
          source_name: 'Source A', category: 'AI', relevance_score: 9, relevance_snippet: 'snippet',
          published_at: twoDaysAgo, created_at: twoDaysAgo, source_type: 'rss',
        },
        {
          id: 'a2', title: 'Recent Medium Score', summary_text: 'Summary 2', source_ref: 'http://b.com',
          source_name: 'Source B', category: 'Tech', relevance_score: 7, relevance_snippet: null,
          published_at: oneHourAgo, created_at: oneHourAgo, source_type: 'rss',
        },
      ],
      error: null,
    }));

    const res = await GET(makeRequest('', 'valid'));
    const body = await res.json();

    expect(body.articles).toHaveLength(2);
    // Recent article with score 7 should rank higher than old article with score 9
    // because recency weight for 1 hour ~= 1.0, but for 48 hours ~= 0.37
    expect(body.articles[0].id).toBe('a2');
    expect(body.articles[1].id).toBe('a1');
    expect(body.articles[0].composite_score).toBeGreaterThan(body.articles[1].composite_score);
  });

  it('marks articles published within 2 hours as is_new', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const now = new Date();
    const recentTime = new Date(now.getTime() - 30 * 60 * 1000).toISOString(); // 30 min ago
    const oldTime = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(); // 3 hours ago

    mockFrom.mockReturnValue(mockSupabaseChain({
      data: [
        { id: 'new1', title: 'New', summary_text: 's', source_ref: 'http://x.com', source_name: null, category: 'AI', relevance_score: 5, relevance_snippet: null, published_at: recentTime, created_at: recentTime, source_type: 'rss' },
        { id: 'old1', title: 'Old', summary_text: 's', source_ref: 'http://y.com', source_name: null, category: 'AI', relevance_score: 5, relevance_snippet: null, published_at: oldTime, created_at: oldTime, source_type: 'rss' },
      ],
      error: null,
    }));

    const res = await GET(makeRequest('', 'valid'));
    const body = await res.json();

    const newArticle = body.articles.find((a: any) => a.id === 'new1');
    const oldArticle = body.articles.find((a: any) => a.id === 'old1');
    expect(newArticle.is_new).toBe(true);
    expect(oldArticle.is_new).toBe(false);
  });

  it('paginates results correctly', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const now = new Date().toISOString();
    const articles = Array.from({ length: 8 }, (_, i) => ({
      id: `a${i}`, title: `Article ${i}`, summary_text: `Summary ${i}`, source_ref: `http://${i}.com`,
      source_name: null, category: 'AI', relevance_score: 10 - i, relevance_snippet: null,
      published_at: now, created_at: now, source_type: 'rss',
    }));

    mockFrom.mockReturnValue(mockSupabaseChain({ data: articles, error: null }));

    // Page 1 with limit 3
    const res1 = await GET(makeRequest('page=1&limit=3', 'valid'));
    const body1 = await res1.json();
    expect(body1.articles).toHaveLength(3);
    expect(body1.has_more).toBe(true);
    expect(body1.page).toBe(1);

    // Page 2
    const res2 = await GET(makeRequest('page=2&limit=3', 'valid'));
    const body2 = await res2.json();
    expect(body2.articles).toHaveLength(3);
    expect(body2.has_more).toBe(true);

    // Page 3 (last)
    const res3 = await GET(makeRequest('page=3&limit=3', 'valid'));
    const body3 = await res3.json();
    expect(body3.articles).toHaveLength(2);
    expect(body3.has_more).toBe(false);
  });

  it('filters by category when provided', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const chain = mockSupabaseChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await GET(makeRequest('category=AI', 'valid'));

    expect(chain.ilike).toHaveBeenCalledWith('category', '%AI%');
  });

  it('returns categories list for filter UI', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const now = new Date().toISOString();
    mockFrom.mockReturnValue(mockSupabaseChain({
      data: [
        { id: '1', title: 'A', summary_text: 's', source_ref: 'http://a.com', source_name: null, category: 'AI', relevance_score: 5, relevance_snippet: null, published_at: now, created_at: now, source_type: 'rss' },
        { id: '2', title: 'B', summary_text: 's', source_ref: 'http://b.com', source_name: null, category: 'Science', relevance_score: 5, relevance_snippet: null, published_at: now, created_at: now, source_type: 'rss' },
        { id: '3', title: 'C', summary_text: 's', source_ref: 'http://c.com', source_name: null, category: 'AI', relevance_score: 5, relevance_snippet: null, published_at: now, created_at: now, source_type: 'rss' },
      ],
      error: null,
    }));

    const res = await GET(makeRequest('', 'valid'));
    const body = await res.json();

    expect(body.categories).toContain('AI');
    expect(body.categories).toContain('Science');
    expect(body.categories).toHaveLength(2);
  });

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue(mockSupabaseChain({ data: null, error: new Error('DB down') }));

    const res = await GET(makeRequest('', 'valid'));
    expect(res.status).toBe(500);
  });
});
