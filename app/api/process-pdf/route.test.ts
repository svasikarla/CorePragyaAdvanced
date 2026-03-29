import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from './route';

// Hoist mocks
const { 
  mockGetAuthUser, 
  mockFrom, 
  mockSelect, 
  mockLimit, 
  mockInsert, 
  mockSingle,
  mockCreateCompletion,
  mockFileTypeFromBuffer,
  mockParsePdf,
  mockRecordTokenUsage
} = vi.hoisted(() => ({
  mockGetAuthUser: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
  mockLimit: vi.fn(),
  mockInsert: vi.fn(),
  mockSingle: vi.fn(),
  mockCreateCompletion: vi.fn(),
  mockFileTypeFromBuffer: vi.fn(),
  mockParsePdf: vi.fn(),
  mockRecordTokenUsage: vi.fn()
}));

// Mock Next.js Responses
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, options) => ({ ...data, status: options?.status || 200 })),
  },
}));

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetAuthUser },
    from: mockFrom,
  }),
}));

// Mock file-type and pdf-parser
vi.mock('file-type', () => ({
  fileTypeFromBuffer: mockFileTypeFromBuffer,
}));

vi.mock('@/lib/pdf-parser', () => ({
  parsePdf: mockParsePdf,
}));

// Mock AI
vi.mock('@/lib/ai-clients', () => ({
  getLLMProvider: () => ({ createCompletion: mockCreateCompletion }),
  getModelForProvider: vi.fn((m) => m),
}));

vi.mock('@/lib/rate-limiting', () => ({
  createRateLimiter: vi.fn(() => ({ isLimited: false })),
  recordTokenUsage: mockRecordTokenUsage,
}));

// jsdom's File lacks arrayBuffer(); polyfill it for testing
function createTestFile(content: string, name: string, type: string): File {
  const file = new File([content], name, { type });
  if (typeof file.arrayBuffer !== 'function') {
    file.arrayBuffer = () => Promise.resolve(new TextEncoder().encode(content).buffer as ArrayBuffer);
  }
  return file;
}

describe('Process PDF API', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAuthUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null });

    // Supabase DB mock chain
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
    });
    mockSelect.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue({ error: null }); // Table exists

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle
      })
    });
    mockSingle.mockResolvedValue({ data: { id: 'kb-id-1' }, error: null });

    // Mock AI completion
    mockCreateCompletion.mockResolvedValue({
      content: JSON.stringify({
        summary_text: "Test AI summary",
        summary_json: { key_points: [] },
        category: "Test Docs"
      }),
      usage: { input_tokens: 10, output_tokens: 20 }
    });
  });

  it('returns 401 if missing auth header', async () => {
    const req = new Request('http://localhost/api/process-pdf', { method: 'POST' });
    const response = await POST(req) as any;
    
    expect(response.status).toBe(401);
    expect(response.error).toBe('Missing or invalid authorization header');
  });

  it('fails if uploaded file is not a valid PDF buffer', async () => {
    // Generate an invalid file type
    mockFileTypeFromBuffer.mockResolvedValue({ mime: 'image/jpeg' });

    // Build FormData directly and mock formData() to avoid jsdom's
    // serialization round-trip which converts File instances to Blob
    const formData = new FormData();
    formData.append('file', createTestFile('fake data', 'test.png', 'image/jpeg'));

    const req = new Request('http://localhost/api/process-pdf', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    vi.spyOn(req, 'formData').mockResolvedValue(formData);

    const response = await POST(req) as any;
    expect(response.status).toBe(400);
    expect(response.error).toBe('Failed to process PDF file');
    expect(response.details).toContain('Uploaded file is not a valid PDF');
  });

  it('successfully extracts text, generates an LLM summary, and pushes to db', async () => {
    // 1. Valid PDF format
    mockFileTypeFromBuffer.mockResolvedValue({ mime: 'application/pdf' });

    // 2. Mock parsePdf returning actual text
    mockParsePdf.mockResolvedValue({
      numpages: 1,
      text: 'This is test PDF text content.',
    });

    // Build FormData directly and mock formData() to avoid jsdom's
    // serialization round-trip which converts File instances to Blob
    const formData = new FormData();
    formData.append('file', createTestFile('valid pdf binary bytes...', 'doc.pdf', 'application/pdf'));

    const req = new Request('http://localhost/api/process-pdf', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token' },
    });
    vi.spyOn(req, 'formData').mockResolvedValue(formData);

    const response = await POST(req) as any;
    
    expect(response.status).toBe(200);
    expect(response.success).toBe(true);

    // Verify AI received the text
    expect(mockCreateCompletion).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'This is test PDF text content.' }]
      })
    );

    // Verify it saved to DB
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_type: 'pdf',
        raw_text: 'This is test PDF text content.',
      })
    );
  });
});
