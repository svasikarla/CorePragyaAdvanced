import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist all mock factories so vi.mock closures can reference them
// ---------------------------------------------------------------------------
const {
  mockAuthGetUser,
  mockSupabaseFrom,
  mockSupabaseInsert,
  mockSupabaseSelect,
  mockSupabaseSingle,
  mockFetchUnreadEmails,
  mockMarkEmailAsRead,
  mockCreateCompletion,
  mockGetLLMProvider,
  mockGetModelForProvider,
  mockGlobalFetch,
} = vi.hoisted(() => ({
  mockAuthGetUser: vi.fn(),
  mockSupabaseFrom: vi.fn(),
  mockSupabaseInsert: vi.fn(),
  mockSupabaseSelect: vi.fn(),
  mockSupabaseSingle: vi.fn(),
  mockFetchUnreadEmails: vi.fn(),
  mockMarkEmailAsRead: vi.fn(),
  mockCreateCompletion: vi.fn(),
  mockGetLLMProvider: vi.fn(),
  mockGetModelForProvider: vi.fn((m: string) => m),
  mockGlobalFetch: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: unknown, options?: { status?: number }) => ({
      ...(data as object),
      status: options?.status ?? 200,
    })),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockAuthGetUser },
    from: mockSupabaseFrom,
  }),
}));

vi.mock('@/lib/email/emailService', () => ({
  fetchUnreadEmails: mockFetchUnreadEmails,
  markEmailAsRead: mockMarkEmailAsRead,
}));

// Covers both static and dynamic imports of ai-clients inside processAndStoreUrl
vi.mock('@/lib/ai-clients', () => ({
  getLLMProvider: mockGetLLMProvider,
  getModelForProvider: mockGetModelForProvider,
}));

// ---------------------------------------------------------------------------
// SUT import (after mocks)
// ---------------------------------------------------------------------------
import { POST } from './route';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal logged-in user object that supabaseAdmin.auth.getUser returns */
const LOGGED_IN_USER = { id: 'user-123', email: 'vasikarla.satish@gmail.com' };

/** A complete EmailData record as returned by fetchUnreadEmails */
const makeEmail = (overrides: Partial<{
  messageId: string;
  from: string;
  senderEmail: string;
  subject: string;
  urls: string[];
  userId: string;
}> = {}) => ({
  messageId: 'msg-001',
  from: 'Satish <vasikarla.satish@gmail.com>',
  senderEmail: 'vasikarla.satish@gmail.com',
  subject: 'Knowledge article',
  urls: ['https://example.com/article'],
  timestamp: new Date(),
  userId: 'user-123',
  ...overrides,
});

/** Create a POST request with a Bearer token */
const makeRequest = (token = 'valid-token') =>
  new Request('http://localhost/api/refresh-from-email', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

/** A valid AI summary payload the LLM returns */
const AI_SUMMARY_JSON = JSON.stringify({
  summary_text: 'This article explains key concepts.',
  summary_json: {
    key_points: ['Point A', 'Point B'],
    main_ideas: ['Idea 1'],
    insights: ['Insight 1'],
  },
  category: 'Technology',
});

/** Stub a successful HTML fetch */
const mockHtmlFetch = (html = '<html><head><title>Test Article</title></head><body><p>Content here.</p></body></html>') => {
  mockGlobalFetch.mockResolvedValueOnce({
    ok: true,
    text: async () => html,
  } as Response);
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('POST /api/refresh-from-email', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Replace the global fetch used inside processAndStoreUrl
    vi.stubGlobal('fetch', mockGlobalFetch);

    // Default: auth succeeds
    mockAuthGetUser.mockResolvedValue({ data: { user: LOGGED_IN_USER }, error: null });

    // Default: no emails
    mockFetchUnreadEmails.mockResolvedValue([]);
    mockMarkEmailAsRead.mockResolvedValue(true);

    // Default: LLM provider
    mockGetLLMProvider.mockReturnValue({ createCompletion: mockCreateCompletion });
    mockCreateCompletion.mockResolvedValue({ content: AI_SUMMARY_JSON });

    // Default: Supabase insert chain  from().insert().select().single()
    mockSupabaseFrom.mockReturnValue({ insert: mockSupabaseInsert });
    mockSupabaseInsert.mockReturnValue({ select: mockSupabaseSelect });
    mockSupabaseSelect.mockReturnValue({ single: mockSupabaseSingle });
    mockSupabaseSingle.mockResolvedValue({
      data: { id: 'kb-001', title: 'Test Article' },
      error: null,
    });
  });

  // =========================================================================
  // Authentication
  // =========================================================================
  describe('Authentication', () => {
    it('returns 401 when Authorization header is absent', async () => {
      const request = new Request('http://localhost/api/refresh-from-email', {
        method: 'POST',
      });

      const response = await POST(request) as any;
      expect(response.status).toBe(401);
      expect(response.error).toMatch(/Missing or invalid authorization header/i);
    });

    it('returns 401 when Authorization header does not start with "Bearer "', async () => {
      const request = new Request('http://localhost/api/refresh-from-email', {
        method: 'POST',
        headers: { Authorization: 'Token abc123' },
      });

      const response = await POST(request) as any;
      expect(response.status).toBe(401);
    });

    it('returns 401 when the bearer token is invalid / user not found', async () => {
      mockAuthGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: { message: 'Invalid JWT' },
      });

      const response = await POST(makeRequest('bad-token')) as any;
      expect(response.status).toBe(401);
      expect(response.error).toBe('Unauthorized');
    });

    it('extracts the token correctly from the Authorization header', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([]);

      await POST(makeRequest('my-secret-token'));

      expect(mockAuthGetUser).toHaveBeenCalledWith('my-secret-token');
    });
  });

  // =========================================================================
  // Email fetching – sender filter
  // =========================================================================
  describe('Email fetching – logged-in user filter', () => {
    it('calls fetchUnreadEmails with the logged-in user email as the sender filter', async () => {
      await POST(makeRequest());

      // The route must scope email fetching to the logged-in user so only
      // emails sent FROM that user TO wiisecache@gmail.com are processed.
      expect(mockFetchUnreadEmails).toHaveBeenCalledWith(
        20,
        'vasikarla.satish@gmail.com'
      );
    });

    it('limits the fetch to 20 emails', async () => {
      await POST(makeRequest());

      expect(mockFetchUnreadEmails).toHaveBeenCalledWith(
        20,
        expect.any(String)
      );
    });

    it('returns 200 with processed:0 and a friendly message when no matching emails', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([]);

      const response = await POST(makeRequest()) as any;
      expect(response.success).toBe(true);
      expect(response.processed).toBe(0);
      expect(response.message).toMatch(/No new emails/i);
    });
  });

  // =========================================================================
  // Gmail auth error propagation
  // =========================================================================
  describe('Gmail auth error handling', () => {
    it('returns 401 with authRequired:true when Gmail auth has expired', async () => {
      mockFetchUnreadEmails.mockRejectedValueOnce(
        new Error('Gmail authentication expired. Please re-authenticate at /setup/gmail')
      );

      const response = await POST(makeRequest()) as any;
      expect(response.status).toBe(401);
      expect(response.authRequired).toBe(true);
      expect(response.setupUrl).toBe('/setup/gmail');
    });

    it('returns 401 with authRequired:true when Gmail is not connected', async () => {
      mockFetchUnreadEmails.mockRejectedValueOnce(
        new Error('Gmail not connected. Please authenticate at /setup/gmail')
      );

      const response = await POST(makeRequest()) as any;
      expect(response.status).toBe(401);
      expect(response.authRequired).toBe(true);
    });

    it('returns 500 for unexpected errors during email fetching', async () => {
      mockFetchUnreadEmails.mockRejectedValueOnce(new Error('Network error'));

      const response = await POST(makeRequest()) as any;
      expect(response.status).toBe(500);
      expect(response.error).toMatch(/Failed to fetch emails/i);
    });
  });

  // =========================================================================
  // URL processing – happy path
  // =========================================================================
  describe('URL processing – success', () => {
    it('fetches the URL content when processing an email', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockHtmlFetch();

      await POST(makeRequest());

      expect(mockGlobalFetch).toHaveBeenCalledWith(
        'https://example.com/article',
        expect.objectContaining({ headers: expect.objectContaining({ 'User-Agent': expect.any(String) }) })
      );
    });

    it('stores processed URL in the knowledgebase with source_type="email"', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockHtmlFetch();

      await POST(makeRequest());

      expect(mockSupabaseFrom).toHaveBeenCalledWith('knowledgebase');
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          source_type: 'email',
          source_ref: 'https://example.com/article',
          category: 'Technology',
          title: 'Test Article',
        })
      );
    });

    it('increments processed count for each successfully stored URL', async () => {
      const email = makeEmail({ urls: ['https://first.com', 'https://second.com'] });
      mockFetchUnreadEmails.mockResolvedValueOnce([email]);

      // Two HTML fetches
      mockHtmlFetch('<html><head><title>First</title></head><body>a</body></html>');
      mockHtmlFetch('<html><head><title>Second</title></head><body>b</body></html>');

      const response = await POST(makeRequest()) as any;
      expect(response.processed).toBe(2);
      expect(response.errors).toBe(0);
    });

    it('marks the email as read after processing all its URLs', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockHtmlFetch();

      await POST(makeRequest());

      expect(mockMarkEmailAsRead).toHaveBeenCalledWith('msg-001');
    });

    it('marks email as read even when some URLs fail to process', async () => {
      const email = makeEmail({ urls: ['https://bad-url.com'] });
      mockFetchUnreadEmails.mockResolvedValueOnce([email]);
      // Simulate fetch failure for the URL
      mockGlobalFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' } as Response);

      await POST(makeRequest());

      // Email must still be marked as read
      expect(mockMarkEmailAsRead).toHaveBeenCalledWith('msg-001');
    });

    it('returns results array with url, success, and title fields', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockHtmlFetch();

      const response = await POST(makeRequest()) as any;
      expect(response.results).toHaveLength(1);
      expect(response.results[0]).toMatchObject({
        url: 'https://example.com/article',
        success: true,
        title: 'Test Article',
      });
    });

    it('includes the email subject as a fallback title when HTML has no <title> tag', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([
        makeEmail({ subject: 'My Subject Fallback' }),
      ]);
      mockHtmlFetch('<html><body>No title tag here</body></html>');

      await POST(makeRequest());

      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Subject Fallback' })
      );
    });

    it('calls the LLM provider to generate a summary of the fetched content', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockHtmlFetch();

      await POST(makeRequest());

      expect(mockCreateCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          model: expect.any(String),
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'user' }),
          ]),
        })
      );
    });
  });

  // =========================================================================
  // URL processing – error paths
  // =========================================================================
  describe('URL processing – error paths', () => {
    it('counts an error when the fetched URL returns a non-OK HTTP status', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockGlobalFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      const response = await POST(makeRequest()) as any;
      expect(response.errors).toBe(1);
      expect(response.processed).toBe(0);
      expect(response.results[0].success).toBe(false);
    });

    it('counts an error when URL content is empty', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockGlobalFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      } as Response);

      const response = await POST(makeRequest()) as any;
      expect(response.errors).toBe(1);
      expect(response.results[0].error).toMatch(/Empty content/i);
    });

    it('prepends https:// to URLs missing a protocol and still processes them', async () => {
      const email = makeEmail({ urls: ['example.com/no-protocol'] });
      mockFetchUnreadEmails.mockResolvedValueOnce([email]);
      mockHtmlFetch('<html><head><title>No Protocol</title></head><body>ok</body></html>');

      const response = await POST(makeRequest()) as any;

      // Should have been fetched with https:// prepended
      expect(mockGlobalFetch).toHaveBeenCalledWith(
        'https://example.com/no-protocol',
        expect.any(Object)
      );
      expect(response.processed).toBe(1);
    });

    it('counts an error for a completely invalid URL string (spaces in URL)', async () => {
      // Spaces in a URL are always rejected by the WHATWG URL constructor
      const email = makeEmail({ urls: ['not a valid url with spaces'] });
      mockFetchUnreadEmails.mockResolvedValueOnce([email]);

      const response = await POST(makeRequest()) as any;
      expect(response.errors).toBe(1);
      expect(response.results[0].success).toBe(false);
      // Route returns 'Invalid URL format' for constructor failures
      expect(response.results[0].error).toMatch(/Invalid URL/i);
    });

    it('counts an error when the fetch call itself throws (e.g. timeout)', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockGlobalFetch.mockRejectedValueOnce(new Error('AbortError'));

      const response = await POST(makeRequest()) as any;
      expect(response.errors).toBe(1);
    });

    it('counts an error when the Supabase insert fails', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockHtmlFetch();
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Unique constraint violation' },
      });

      const response = await POST(makeRequest()) as any;
      expect(response.errors).toBe(1);
      expect(response.results[0].success).toBe(false);
      expect(response.results[0].error).toMatch(/Database error/i);
    });

    it('uses a fallback structure when LLM response is not valid JSON', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockHtmlFetch();
      // LLM returns plain text instead of JSON
      mockCreateCompletion.mockResolvedValueOnce({
        content: 'This is a plain text summary and not JSON.',
      });

      const response = await POST(makeRequest()) as any;
      // Should still succeed with fallback data
      expect(response.processed).toBe(1);
      expect(mockSupabaseInsert).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Other' })
      );
    });

    it('handles emails with no processable URLs gracefully', async () => {
      // Email with no URLs returns 0 processed and 0 errors
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail({ urls: [] })]);

      const response = await POST(makeRequest()) as any;
      expect(response.processed).toBe(0);
      expect(response.errors).toBe(0);
    });
  });

  // =========================================================================
  // Multi-email processing
  // =========================================================================
  describe('Multi-email processing', () => {
    it('processes all emails and aggregates processed/error counts', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([
        makeEmail({ messageId: 'msg-1', urls: ['https://good.com'] }),
        makeEmail({ messageId: 'msg-2', urls: ['https://bad.com'] }),
      ]);

      // good.com succeeds
      mockHtmlFetch('<html><head><title>Good</title></head><body>ok</body></html>');
      // bad.com returns HTTP error
      mockGlobalFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const response = await POST(makeRequest()) as any;
      expect(response.processed).toBe(1);
      expect(response.errors).toBe(1);
    });

    it('marks every processed email as read', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([
        makeEmail({ messageId: 'msg-1' }),
        makeEmail({ messageId: 'msg-2' }),
      ]);
      mockHtmlFetch();
      mockHtmlFetch();

      await POST(makeRequest());

      expect(mockMarkEmailAsRead).toHaveBeenCalledTimes(2);
      expect(mockMarkEmailAsRead).toHaveBeenCalledWith('msg-1');
      expect(mockMarkEmailAsRead).toHaveBeenCalledWith('msg-2');
    });

    it('includes a success message with counts in the response', async () => {
      mockFetchUnreadEmails.mockResolvedValueOnce([makeEmail()]);
      mockHtmlFetch();

      const response = await POST(makeRequest()) as any;
      expect(response.success).toBe(true);
      expect(response.message).toMatch(/1 URLs from 1 email/i);
    });
  });

  // =========================================================================
  // Unhandled / top-level error
  // =========================================================================
  describe('Unhandled top-level errors', () => {
    it('returns 500 when an unexpected exception bubbles up from the handler', async () => {
      // Force an unexpected throw before email fetching
      mockAuthGetUser.mockRejectedValueOnce(new Error('Unexpected crash'));

      const response = await POST(makeRequest()) as any;
      expect(response.status).toBe(500);
      expect(response.success).toBe(false);
      expect(response.error).toMatch(/Internal server error/i);
    });
  });
});
