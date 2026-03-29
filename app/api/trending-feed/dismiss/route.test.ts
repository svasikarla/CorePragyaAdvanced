import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

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

function makeRequest(body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request('http://localhost/api/trending-feed/dismiss', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('Trending Feed Dismiss API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no Authorization header', async () => {
    const res = await POST(makeRequest({ articleId: 'a1' }));
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 400 when articleId is missing', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const res = await POST(makeRequest({}, 'valid'));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('articleId is required');
  });

  it('returns 404 when article does not exist', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const selectChain: any = {};
    selectChain.select = vi.fn().mockReturnValue(selectChain);
    selectChain.eq = vi.fn().mockReturnValue(selectChain);
    selectChain.single = vi.fn().mockResolvedValue({ data: null, error: new Error('not found') });
    mockFrom.mockReturnValue(selectChain);

    const res = await POST(makeRequest({ articleId: 'nonexistent' }, 'valid'));
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.error).toBe('Article not found');
  });

  it('returns 403 when article belongs to another user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const selectChain: any = {};
    selectChain.select = vi.fn().mockReturnValue(selectChain);
    selectChain.eq = vi.fn().mockReturnValue(selectChain);
    selectChain.single = vi.fn().mockResolvedValue({
      data: { id: 'a1', user_id: 'other-user', category: 'AI' },
      error: null,
    });
    mockFrom.mockReturnValue(selectChain);

    const res = await POST(makeRequest({ articleId: 'a1' }, 'valid'));
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Forbidden');
  });

  it('successfully dismisses article and records negative feedback', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'knowledgebase') {
        callCount++;
        if (callCount === 1) {
          // First call: select to verify ownership
          const chain: any = {};
          chain.select = vi.fn().mockReturnValue(chain);
          chain.eq = vi.fn().mockReturnValue(chain);
          chain.single = vi.fn().mockResolvedValue({
            data: { id: 'a1', user_id: 'u1', category: 'AI' },
            error: null,
          });
          return chain;
        }
        // Second call: update is_dismissed
        return { update: mockUpdate };
      }
      if (table === 'trending_metrics') {
        // Metrics lookup — no existing record
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        chain.insert = mockInsert;
        return chain;
      }
      return {};
    });

    const res = await POST(makeRequest({ articleId: 'a1' }, 'valid'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ is_dismissed: true });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ entity_name: 'dismissed:AI', search_count: 1 })
    );
  });

  it('increments existing trending_metrics count on repeated dismissals', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    const mockMetricUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'knowledgebase') {
        callCount++;
        if (callCount === 1) {
          const chain: any = {};
          chain.select = vi.fn().mockReturnValue(chain);
          chain.eq = vi.fn().mockReturnValue(chain);
          chain.single = vi.fn().mockResolvedValue({
            data: { id: 'a1', user_id: 'u1', category: 'Science' },
            error: null,
          });
          return chain;
        }
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === 'trending_metrics') {
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        // Existing record with count=3
        chain.single = vi.fn().mockResolvedValue({
          data: { id: 'metric-1', search_count: 3 },
          error: null,
        });
        chain.update = mockMetricUpdate;
        return chain;
      }
      return {};
    });

    const res = await POST(makeRequest({ articleId: 'a1' }, 'valid'));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(mockMetricUpdate).toHaveBeenCalledWith({ search_count: 4 });
  });
});
