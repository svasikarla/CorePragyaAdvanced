import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

const { mockGetUser, mockFrom, mockCreateCompletion, mockGetLLMProvider, mockGetModelForProvider } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFrom: vi.fn(),
  mockCreateCompletion: vi.fn(),
  mockGetLLMProvider: vi.fn(),
  mockGetModelForProvider: vi.fn((m: string) => m),
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

function mockSupabaseChain(resolvedValue: { data: any; error: any }) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.then = (cb: any) => Promise.resolve(resolvedValue).then(cb);
  return chain;
}

function makeRequest(token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return new Request('http://localhost/api/generate-insights', {
    method: 'POST',
    headers,
  });
}

describe('Generate Insights API - POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLLMProvider.mockReturnValue({ createCompletion: mockCreateCompletion });
  });

  it('returns 401 when no authorization header', async () => {
    const res = await POST(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 401 when token is invalid', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid') });

    const res = await POST(makeRequest('bad'));
    const body = await res.json();
    expect(res.status).toBe(401);
  });

  it('returns welcome insights when user has no KB entries', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockFrom.mockReturnValue(mockSupabaseChain({ data: [], error: null }));

    const res = await POST(makeRequest('valid'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.insights).toHaveLength(3);
    expect(body.insights[0]).toContain('Welcome');
    expect(body.trending_topics).toEqual([]);
    expect(mockCreateCompletion).not.toHaveBeenCalled();
  });

  it('calls LLM with entry digest and returns parsed insights', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    mockFrom.mockReturnValue(mockSupabaseChain({
      data: [
        { id: 'e1', summary_text: 'AI advances in healthcare', summary_json: { key_points: ['point1'] }, category: 'AI', source_type: 'url', source_ref: 'http://a.com', created_at: new Date().toISOString() },
        { id: 'e2', summary_text: 'Quantum computing breakthroughs', summary_json: null, category: 'Science', source_type: 'pdf', source_ref: 'file.pdf', created_at: new Date().toISOString() },
      ],
      error: null,
    }));

    const mockResponse = JSON.stringify({
      trending_topics: [
        { name: 'AI Healthcare', description: 'Growing intersection', relevance: 9 },
        { name: 'Quantum Tech', description: 'Emerging field', relevance: 7 },
      ],
      insights: [
        'Your interests in AI and quantum computing suggest an emerging focus on computational science.',
        'Consider exploring quantum machine learning as a bridge between your top areas.',
      ],
    });

    mockCreateCompletion.mockResolvedValue({ content: mockResponse });

    const res = await POST(makeRequest('valid'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.insights).toHaveLength(2);
    expect(body.trending_topics).toHaveLength(2);
    // Sorted by relevance descending
    expect(body.trending_topics[0].name).toBe('AI Healthcare');
    expect(body.trending_topics[0].relevance).toBe(9);
    expect(mockCreateCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0.3,
        max_tokens: 1200,
      })
    );
  });

  it('falls back to category-based insights when LLM output is unparseable', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    mockFrom.mockReturnValue(mockSupabaseChain({
      data: [
        { id: 'e1', summary_text: 'Summary 1', summary_json: null, category: 'Technology', source_type: 'url', source_ref: 'http://a.com', created_at: new Date().toISOString() },
        { id: 'e2', summary_text: 'Summary 2', summary_json: null, category: 'Technology', source_type: 'url', source_ref: 'http://b.com', created_at: new Date().toISOString() },
        { id: 'e3', summary_text: 'Summary 3', summary_json: null, category: 'Science', source_type: 'url', source_ref: 'http://c.com', created_at: new Date().toISOString() },
      ],
      error: null,
    }));

    mockCreateCompletion.mockResolvedValue({ content: 'This is not valid JSON at all!!!' });

    const res = await POST(makeRequest('valid'));
    const body = await res.json();

    expect(res.status).toBe(200);
    // Fallback generates topics from categories
    expect(body.trending_topics.length).toBeGreaterThan(0);
    expect(body.trending_topics[0].name).toBe('Technology');
    expect(body.insights.length).toBeGreaterThan(0);
  });

  it('includes key_points and source_type in the LLM prompt digest', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });

    mockFrom.mockReturnValue(mockSupabaseChain({
      data: [
        { id: 'e1', summary_text: 'AI paper summary', summary_json: { key_points: ['KP1', 'KP2'] }, category: 'AI', source_type: 'rss', source_ref: 'http://rss.com', created_at: new Date().toISOString() },
      ],
      error: null,
    }));

    mockCreateCompletion.mockResolvedValue({
      content: JSON.stringify({ trending_topics: [], insights: ['insight'] }),
    });

    await POST(makeRequest('valid'));

    const callArgs = mockCreateCompletion.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).toContain('(RSS)');
    expect(userMessage).toContain('KP1; KP2');
  });
});
