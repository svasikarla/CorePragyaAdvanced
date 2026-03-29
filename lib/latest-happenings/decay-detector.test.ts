import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectKnowledgeDecay } from './decay-detector';

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockRpc = vi.fn();

const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
} as any;

const mockAnthropic = {
  messages: {
    create: vi.fn(),
  }
} as any;

describe('Knowledge Decay Detector', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
    });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ gte: mockGte, limit: mockLimit, single: mockSingle });
  });

  it('exits early if no recent news is found', async () => {
    // 1. Mock supabase returning empty array for recent news
    mockGte.mockResolvedValueOnce({ data: [], error: null });

    const result = await detectKnowledgeDecay(mockSupabase, mockAnthropic);
    expect(result).toEqual({ status: 'no_news' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('detects no contradictions if LLM says NO', async () => {
    // 1. News from the last 2 hours
    mockGte.mockResolvedValueOnce({ 
      data: [{ id: 'news-1', raw_text: 'Apple released M4', user_id: 'user-1' }], 
      error: null 
    });

    // 2. Fetch embeddings for new news
    mockLimit.mockResolvedValueOnce({ 
      data: [{ embedding: [0.1, 0.2] }], 
      error: null 
    });

    // 3. RPC search returns an older matching snippet
    mockRpc.mockResolvedValueOnce({
      data: [{ knowledge_base_id: 'old-1' }],
      error: null
    });

    // 4. Fetch the old snippet's text
    mockSingle.mockResolvedValueOnce({
      data: { id: 'old-1', raw_text: 'Apple released M3 last year.' },
      error: null
    });

    // 5. Mock the Anthropic 'NO' response (Not a contradiction, just older text)
    mockAnthropic.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'NO' }]
    });

    const result = await detectKnowledgeDecay(mockSupabase, mockAnthropic);

    expect(result).toEqual({ status: 'success', contradictions: 0 });
    expect(mockInsert).not.toHaveBeenCalled(); // No alert generated
  });

  it('generates a proactive alert if the LLM says YES', async () => {
    // 1. News from the last 2 hours
    mockGte.mockResolvedValueOnce({ 
      data: [{ id: 'news-2', raw_text: 'The moon is made of cheese now.', user_id: 'user-1' }], 
      error: null 
    });

    // 2. Fetch embeddings for new news
    mockLimit.mockResolvedValueOnce({ 
      data: [{ embedding: [0.9, 0.9] }], 
      error: null 
    });

    // 3. RPC search returns an older matching snippet
    mockRpc.mockResolvedValueOnce({
      data: [{ knowledge_base_id: 'old-2' }],
      error: null
    });

    // 4. Fetch the old snippet's text
    mockSingle.mockResolvedValueOnce({
      data: { id: 'old-2', raw_text: 'The moon is made of rock.' },
      error: null
    });

    // 5. Mock the Anthropic 'YES' response
    mockAnthropic.messages.create.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'YES - This completely contradicts.' }]
    });

    mockInsert.mockResolvedValueOnce({ error: null });

    const result = await detectKnowledgeDecay(mockSupabase, mockAnthropic);

    expect(result).toEqual({ status: 'success', contradictions: 1 });
    // Alert should be generated
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      type: 'contradiction',
      source_node_id: 'old-2',
      new_news_id: 'news-2',
    }));
  });
});
