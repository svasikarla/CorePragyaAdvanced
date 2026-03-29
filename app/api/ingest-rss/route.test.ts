import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

// Hoist mocks so they're available before imports
const {
  mockGetUser,
  mockFrom,
  mockGenerateEmbeddings,
  mockCreateCompletion,
  mockFetch,
} = vi.hoisted(() => {
  return {
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockGenerateEmbeddings: vi.fn(),
    mockCreateCompletion: vi.fn(),
    mockFetch: vi.fn(),
  };
});

// Mock global fetch for RSS XML requests
global.fetch = mockFetch;

// Mock @supabase/supabase-js (what the route actually imports)
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

// Mock AI clients
vi.mock('@/lib/ai-clients', () => ({
  generateEmbeddings: mockGenerateEmbeddings,
  getLLMProvider: () => ({ createCompletion: mockCreateCompletion }),
  getModelForProvider: (model: string) => model,
}));

// Helper: builds a chainable Supabase query mock that resolves to { data, error }
function mockSupabaseChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {};
  const resolve = () => resolvedValue;

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue(resolvedValue);
  // Make the chain itself awaitable (for queries without .single())
  chain.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return chain;
}

function makeRequest(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request('http://localhost/api/ingest-rss', { method: 'POST', headers });
}

describe('RSS Ingestion API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateEmbeddings.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mockCreateCompletion.mockResolvedValue({ content: '["Technology"]' });
  });

  it('returns 401 when no Authorization header is present', async () => {
    const req = makeRequest();
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Missing authorization');
  });

  it('returns 401 when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });

    const req = makeRequest('bad-token');
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns success with 0 articles when user has no active subscriptions', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    // user_subscriptions returns empty array (no feeds with active status after filter)
    mockFrom.mockReturnValue(mockSupabaseChain({ data: [], error: null }));

    const req = makeRequest('valid-token');
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.processed_articles).toBe(0);
    expect(body.message).toBe('No active subscriptions');
  });

  it('returns 500 when subscriptions query fails', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mockFrom.mockReturnValue(mockSupabaseChain({ data: null, error: new Error('DB Error') }));

    const req = makeRequest('valid-token');
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch subscriptions');
  });

  it('processes a new RSS article end-to-end', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    const mockXML = `
      <rss><channel>
        <item>
          <title><![CDATA[Test News Title]]></title>
          <description><![CDATA[This is a test description.]]></description>
          <link>https://testfeed.com/news1</link>
        </item>
      </channel></rss>`;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_subscriptions') {
        return mockSupabaseChain({
          data: [{ rss_feeds: { id: 'feed-1', url: 'https://testfeed.com/rss', name: 'Test Feed', status: 'active' } }],
          error: null,
        });
      }
      if (table === 'knowledgebase') {
        // Build a chain that handles both the .in() duplicate check and the .insert().select().single() insert
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.insert = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        // .in() for batch duplicate check — returns empty (no duplicates)
        chain.in = vi.fn().mockReturnValue({
          then: (cb: any) => Promise.resolve({ data: [], error: null }).then(cb),
        });
        // .single() for the insert result
        chain.single = vi.fn().mockResolvedValue({ data: { id: 'kb-1' }, error: null });
        return chain;
      }
      // embeddings, rss_feeds, trending_metrics — all succeed silently
      return mockSupabaseChain({ data: null, error: null });
    });

    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(mockXML) });

    const req = makeRequest('valid-token');
    const response = await POST(req);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.processed_articles).toBe(1);
    expect(mockGenerateEmbeddings).toHaveBeenCalledWith(expect.stringContaining('Test News Title'));
    expect(mockCreateCompletion).toHaveBeenCalled();
  });

  it('skips articles that already exist in the KB', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

    const mockXML = `
      <rss><channel>
        <item>
          <title>Duplicate News</title>
          <description>Already ingested</description>
          <link>https://testfeed.com/dup</link>
        </item>
      </channel></rss>`;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_subscriptions') {
        return mockSupabaseChain({
          data: [{ rss_feeds: { id: 'feed-1', url: 'https://testfeed.com/rss', name: 'Test Feed', status: 'active' } }],
          error: null,
        });
      }
      if (table === 'knowledgebase') {
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        // .in() returns the link as existing — item is a duplicate
        chain.in = vi.fn().mockReturnValue({
          then: (cb: any) => Promise.resolve({ data: [{ source_ref: 'https://testfeed.com/dup' }], error: null }).then(cb),
        });
        return chain;
      }
      // rss_feeds update
      return mockSupabaseChain({ data: null, error: null });
    });

    mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve(mockXML) });

    const req = makeRequest('valid-token');
    const response = await POST(req);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.processed_articles).toBe(0);
    expect(mockGenerateEmbeddings).not.toHaveBeenCalled();
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });
});
