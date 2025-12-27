import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from './route';

// Define mocks using vi.hoisted to ensure they are available before imports
const {
    mockRpc,
    mockFrom,
    mockSelect,
    mockIn,
    mockAuthGetUser,
    mockGenerateEmbeddings,
    mockGetLLMProvider,
    mockGetModelForProvider
} = vi.hoisted(() => ({
    mockRpc: vi.fn(),
    mockFrom: vi.fn(),
    mockSelect: vi.fn(),
    mockIn: vi.fn(),
    mockAuthGetUser: vi.fn(),
    mockGenerateEmbeddings: vi.fn(),
    mockGetLLMProvider: vi.fn(),
    mockGetModelForProvider: vi.fn((model: any) => model),
}));

// Mock Next.js server components
vi.mock('next/server', () => ({
    NextResponse: {
        json: vi.fn((data, options) => ({ ...data, status: options?.status || 200 })),
    },
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
    createClient: () => ({
        auth: {
            getUser: mockAuthGetUser,
        },
        rpc: mockRpc,
        from: mockFrom,
    }),
}));

// Mock AI Clients
vi.mock('@/lib/ai-clients', () => ({
    generateEmbeddings: mockGenerateEmbeddings,
    getLLMProvider: mockGetLLMProvider,
    getModelForProvider: mockGetModelForProvider,
}));

import { generateEmbeddings, getLLMProvider } from '@/lib/ai-clients';

describe('RAG Search API', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mocks setup
        mockAuthGetUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });
        (generateEmbeddings as any).mockResolvedValue([[0.1, 0.2, 0.3]]);

        // Setup chaining for DB queries
        mockFrom.mockReturnValue({ select: mockSelect });
        mockSelect.mockReturnValue({ in: mockIn });
        mockIn.mockResolvedValue({ data: [], error: null });
    });

    it('should return 401 if no authorization header', async () => {
        const request = new Request('http://localhost/api/rag-search', {
            method: 'POST',
            body: JSON.stringify({ query: 'test' }),
        });

        const response = await POST(request) as any;
        expect(response).toEqual(expect.objectContaining({ error: 'Missing or invalid authorization header', status: 401 }));
    });

    it('should return 400 if query is missing', async () => {
        const request = new Request('http://localhost/api/rag-search', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid-token' },
            body: JSON.stringify({}),
        });

        const response = await POST(request) as any;
        expect(response).toEqual(expect.objectContaining({ error: 'Query is required', status: 400 }));
    });

    it('should handle search with no results', async () => {
        const request = new Request('http://localhost/api/rag-search', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid-token' },
            body: JSON.stringify({ query: 'test query' }),
        });

        // Mock empty vector search results
        mockRpc.mockResolvedValue({ data: [], error: null });

        const response = await POST(request) as any;

        expect(generateEmbeddings).toHaveBeenCalledWith('test query');
        expect(response).toEqual(expect.objectContaining({
            results: [],
            message: 'No similar content found'
        }));
    });

    it('should perform vector search and return results', async () => {
        const request = new Request('http://localhost/api/rag-search', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid-token' },
            body: JSON.stringify({ query: 'test query', useAI: false }),
        });

        // Mock vector search results
        const mockChunks = [
            { id: 'chunk-1', kb_id: 'kb-1', chunk_text: 'Text 1', similarity: 0.9 },
        ];
        mockRpc.mockResolvedValue({ data: mockChunks, error: null });

        // Mock KB entry fetch
        const mockKBEntries = [
            { id: 'kb-1', title: 'Doc 1', source_ref: 'http://test.com' }
        ];
        mockIn.mockResolvedValue({ data: mockKBEntries, error: null });

        const response = await POST(request) as any;

        expect(mockRpc).toHaveBeenCalledWith(
            'match_embeddings',
            expect.objectContaining({ match_threshold: 0.5 })
        );
        expect(response.results).toHaveLength(1);
        expect(response.results[0].title).toBe('Doc 1');
        expect(response.aiResponse).toBeNull();
    });

    it('should call LLM provider when useAI is true', async () => {
        const request = new Request('http://localhost/api/rag-search', {
            method: 'POST',
            headers: { Authorization: 'Bearer valid-token' },
            body: JSON.stringify({ query: 'test query', useAI: true }),
        });

        // Mock vector search & KB fetch
        mockRpc.mockResolvedValue({ data: [{ id: 'c1', kb_id: 'k1', chunk_text: 'Context', similarity: 0.9 }], error: null });
        mockIn.mockResolvedValue({ data: [{ id: 'k1', title: 'Doc' }], error: null });

        // Mock LLM response
        const mockCompletion = { content: 'AI Answer', usage: { input_tokens: 10, output_tokens: 5 } };
        mockGetLLMProvider.mockReturnValue({
            createCompletion: vi.fn().mockResolvedValue(mockCompletion),
        });

        const response = await POST(request) as any;

        expect(response.aiResponse).toBe('AI Answer');
    });
});
