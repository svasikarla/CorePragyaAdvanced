import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoist all mock factories BEFORE any import so vi.mock can reference them
// ---------------------------------------------------------------------------
const {
  mockSupabaseFrom,
  mockSupabaseSelect,
  mockSupabaseEq,
  mockSupabaseSingle,
  mockSetupGmailClient,
  mockGmailMessagesList,
  mockGmailMessagesGet,
  mockGmailMessagesModify,
} = vi.hoisted(() => ({
  mockSupabaseFrom: vi.fn(),
  mockSupabaseSelect: vi.fn(),
  mockSupabaseEq: vi.fn(),
  mockSupabaseSingle: vi.fn(),
  mockSetupGmailClient: vi.fn(),
  mockGmailMessagesList: vi.fn(),
  mockGmailMessagesGet: vi.fn(),
  mockGmailMessagesModify: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: mockSupabaseFrom,
  }),
}));

vi.mock('@/lib/auth/googleAuth', () => ({
  setupGmailClient: mockSetupGmailClient,
}));

// ---------------------------------------------------------------------------
// Actual imports (resolved after mocks are hoisted)
// ---------------------------------------------------------------------------
import {
  extractURLsFromBody,
  verifyRegisteredUser,
  processEmailMessage,
  markEmailAsRead,
  fetchUnreadEmails,
} from '@/lib/email/emailService';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
/** Build a base64-encoded email body as the Gmail API returns it */
const b64 = (text: string) => Buffer.from(text).toString('base64');

/** Minimal Gmail message stub used by most tests */
const makeGmailMessage = ({
  from = 'sender@example.com',
  subject = 'Test Subject',
  date = 'Mon, 01 Jan 2024 00:00:00 +0000',
  bodyText = 'Visit https://example.com for more',
  multipart = false,
}: {
  from?: string;
  subject?: string;
  date?: string;
  bodyText?: string;
  multipart?: boolean;
} = {}) => ({
  data: {
    payload: {
      headers: [
        { name: 'From', value: from },
        { name: 'Subject', value: subject },
        { name: 'Date', value: date },
      ],
      ...(multipart
        ? {
            parts: [
              // HTML part should be ignored in favour of text/plain
              { mimeType: 'text/html', body: { data: b64('<p>HTML</p>') } },
              { mimeType: 'text/plain', body: { data: b64(bodyText) } },
            ],
          }
        : {
            body: { data: b64(bodyText) },
          }),
    },
  },
});

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe('Email Service – wiisecache@gmail.com integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Set the inbox address env var that the service always uses
    process.env.GMAIL_USER_EMAIL = 'wiisecache@gmail.com';

    // Default Gmail client stub returned by setupGmailClient
    mockSetupGmailClient.mockResolvedValue({
      users: {
        messages: {
          list: mockGmailMessagesList,
          get: mockGmailMessagesGet,
          modify: mockGmailMessagesModify,
        },
      },
    });

    // Default Supabase chain: from().select().eq().single()
    mockSupabaseFrom.mockReturnValue({ select: mockSupabaseSelect });
    mockSupabaseSelect.mockReturnValue({ eq: mockSupabaseEq });
    mockSupabaseEq.mockReturnValue({ single: mockSupabaseSingle });
    mockSupabaseSingle.mockResolvedValue({ data: null, error: null });
  });

  // =========================================================================
  // extractURLsFromBody
  // =========================================================================
  describe('extractURLsFromBody', () => {
    it('returns empty array when body contains no URLs', () => {
      expect(extractURLsFromBody('Hello, no links here!')).toEqual([]);
    });

    it('returns empty array for an empty string', () => {
      expect(extractURLsFromBody('')).toEqual([]);
    });

    it('extracts a single https:// URL', () => {
      const urls = extractURLsFromBody('Check this out: https://example.com/article');
      expect(urls).toContain('https://example.com/article');
      expect(urls).toHaveLength(1);
    });

    it('extracts a single http:// URL', () => {
      const urls = extractURLsFromBody('Visit http://example.com for more');
      expect(urls.some(u => u.startsWith('http://example.com'))).toBe(true);
    });

    it('extracts multiple distinct URLs from one body', () => {
      const body = 'See https://first.com and https://second.com/page for details';
      const urls = extractURLsFromBody(body);
      expect(urls.some(u => u.includes('first.com'))).toBe(true);
      expect(urls.some(u => u.includes('second.com'))).toBe(true);
    });

    it('deduplicates identical URLs appearing more than once', () => {
      const body =
        'https://example.com is great. Also visit https://example.com again.';
      const urls = extractURLsFromBody(body);
      const count = urls.filter(u => u.includes('example.com')).length;
      expect(count).toBe(1);
    });

    it('extracts www. URLs without an explicit protocol prefix', () => {
      const urls = extractURLsFromBody('Go to www.example.com for details');
      expect(urls.some(u => u.includes('www.example.com'))).toBe(true);
    });

    it('extracts URLs with query parameters and hash fragments', () => {
      const url = 'https://example.com/article?id=123&ref=email#section';
      const urls = extractURLsFromBody(`Check ${url}`);
      expect(urls.some(u => u.includes('example.com/article'))).toBe(true);
    });

    it('extracts URLs with subdomains', () => {
      const urls = extractURLsFromBody('See https://blog.example.com/post-1 for info');
      expect(urls.some(u => u.includes('blog.example.com'))).toBe(true);
    });

    it('handles URLs embedded in typical email forwarding text', () => {
      const body =
        'FYI – I found this useful:\nhttps://research.example.org/paper-42\n\nBest,\nSatish';
      const urls = extractURLsFromBody(body);
      expect(urls.some(u => u.includes('research.example.org'))).toBe(true);
    });
  });

  // =========================================================================
  // verifyRegisteredUser
  // =========================================================================
  describe('verifyRegisteredUser', () => {
    it('returns the user ID when the email belongs to a registered user', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'user-abc' }, error: null });

      const result = await verifyRegisteredUser('registered@example.com');

      expect(result).toBe('user-abc');
      expect(mockSupabaseFrom).toHaveBeenCalledWith('users');
      expect(mockSupabaseEq).toHaveBeenCalledWith('email', 'registered@example.com');
    });

    it('returns null when Supabase finds no matching user', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await verifyRegisteredUser('unknown@example.com');
      expect(result).toBeNull();
    });

    it('returns null when Supabase returns an error with data absent', async () => {
      mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });

      expect(await verifyRegisteredUser('user@example.com')).toBeNull();
    });

    it('returns null and does not throw when Supabase client throws an exception', async () => {
      mockSupabaseSingle.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await verifyRegisteredUser('user@example.com');
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // processEmailMessage
  // =========================================================================
  describe('processEmailMessage', () => {
    const stub = { id: 'msg-001' };

    it('returns null when the sender is not a registered user', async () => {
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({ from: 'stranger@example.com' })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      expect(await processEmailMessage(stub)).toBeNull();
    });

    it('returns null when the email body contains no URLs', async () => {
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({ bodyText: 'No links here, just plain text.' })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'user-abc' }, error: null });

      expect(await processEmailMessage(stub)).toBeNull();
    });

    it('returns null when the message has no payload headers', async () => {
      mockGmailMessagesGet.mockResolvedValueOnce({ data: { payload: {} } });

      expect(await processEmailMessage(stub)).toBeNull();
    });

    it('returns null when the Gmail API call throws', async () => {
      mockGmailMessagesGet.mockRejectedValueOnce(new Error('Gmail API error'));

      expect(await processEmailMessage(stub)).toBeNull();
    });

    it('returns correct EmailData for a registered sender with a simple body', async () => {
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({
          from: 'Satish <vasikarla.satish@gmail.com>',
          subject: 'Interesting Read',
          bodyText: 'Check out https://arxiv.org/paper-123',
        })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'user-xyz' }, error: null });

      const result = await processEmailMessage(stub);

      expect(result).not.toBeNull();
      expect(result?.messageId).toBe('msg-001');
      expect(result?.senderEmail).toBe('vasikarla.satish@gmail.com');
      expect(result?.subject).toBe('Interesting Read');
      expect(result?.urls).toContain('https://arxiv.org/paper-123');
      expect(result?.userId).toBe('user-xyz');
    });

    it('prefers text/plain part in a multipart email', async () => {
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({
          from: 'vasikarla.satish@gmail.com',
          bodyText: 'Read https://multipart.example.com/article',
          multipart: true,
        })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'user-xyz' }, error: null });

      const result = await processEmailMessage(stub);
      expect(result?.urls).toContain('https://multipart.example.com/article');
    });

    it('extracts sender email from angle-bracket format', async () => {
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({ from: 'John Doe <john@domain.com>' })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'u1' }, error: null });

      const result = await processEmailMessage(stub);
      expect(result?.senderEmail).toBe('john@domain.com');
    });

    it('extracts sender email from plain address format', async () => {
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({ from: 'john@domain.com' })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'u1' }, error: null });

      const result = await processEmailMessage(stub);
      expect(result?.senderEmail).toBe('john@domain.com');
    });

    it('calls Gmail API with GMAIL_USER_EMAIL (wiisecache@gmail.com) as userId', async () => {
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({ bodyText: 'https://example.com' })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'u1' }, error: null });

      await processEmailMessage(stub);

      expect(mockGmailMessagesGet).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'wiisecache@gmail.com',
          id: 'msg-001',
          format: 'full',
        })
      );
    });
  });

  // =========================================================================
  // markEmailAsRead
  // =========================================================================
  describe('markEmailAsRead', () => {
    it('returns true and calls Gmail modify with correct parameters', async () => {
      mockGmailMessagesModify.mockResolvedValueOnce({});

      const result = await markEmailAsRead('msg-001');

      expect(result).toBe(true);
      expect(mockGmailMessagesModify).toHaveBeenCalledWith({
        userId: 'wiisecache@gmail.com',
        id: 'msg-001',
        requestBody: { removeLabelIds: ['UNREAD'] },
      });
    });

    it('returns false when the Gmail API call throws an error', async () => {
      mockGmailMessagesModify.mockRejectedValueOnce(new Error('Permission denied'));

      expect(await markEmailAsRead('msg-001')).toBe(false);
    });

    it('returns false when setupGmailClient fails', async () => {
      mockSetupGmailClient.mockRejectedValueOnce(new Error('Auth error'));

      expect(await markEmailAsRead('msg-999')).toBe(false);
    });
  });

  // =========================================================================
  // fetchUnreadEmails
  // =========================================================================
  describe('fetchUnreadEmails', () => {
    it('queries wiisecache@gmail.com inbox with base "is:unread" when no sender filter', async () => {
      mockGmailMessagesList.mockResolvedValueOnce({ data: { messages: [] } });

      await fetchUnreadEmails(10);

      expect(mockGmailMessagesList).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'wiisecache@gmail.com',
          q: 'is:unread',
          maxResults: 10,
        })
      );
    });

    it('appends "from:<userEmail>" filter when userEmail is provided (logged-in user scope)', async () => {
      mockGmailMessagesList.mockResolvedValueOnce({ data: { messages: [] } });

      await fetchUnreadEmails(20, 'vasikarla.satish@gmail.com');

      expect(mockGmailMessagesList).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'is:unread from:vasikarla.satish@gmail.com',
          userId: 'wiisecache@gmail.com',
        })
      );
    });

    it('uses the default maxResults of 50 when not specified', async () => {
      mockGmailMessagesList.mockResolvedValueOnce({ data: { messages: [] } });

      await fetchUnreadEmails();

      expect(mockGmailMessagesList).toHaveBeenCalledWith(
        expect.objectContaining({ maxResults: 50 })
      );
    });

    it('returns an empty array when no messages are found', async () => {
      mockGmailMessagesList.mockResolvedValueOnce({ data: { messages: [] } });

      expect(await fetchUnreadEmails()).toEqual([]);
    });

    it('returns an empty array when messages property is undefined', async () => {
      mockGmailMessagesList.mockResolvedValueOnce({ data: {} });

      expect(await fetchUnreadEmails()).toEqual([]);
    });

    it('returns EmailData for each valid email with URLs from registered senders', async () => {
      mockGmailMessagesList.mockResolvedValueOnce({
        data: { messages: [{ id: 'msg-1' }] },
      });
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({
          from: 'vasikarla.satish@gmail.com',
          subject: 'Knowledge share',
          bodyText: 'See https://nature.com/article for info',
        })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'user-123' }, error: null });

      const results = await fetchUnreadEmails(10, 'vasikarla.satish@gmail.com');

      expect(results).toHaveLength(1);
      expect(results[0].senderEmail).toBe('vasikarla.satish@gmail.com');
      expect(results[0].urls).toContain('https://nature.com/article');
      expect(results[0].userId).toBe('user-123');
    });

    it('skips emails that processEmailMessage returns null for (no URLs / unregistered)', async () => {
      mockGmailMessagesList.mockResolvedValueOnce({
        data: { messages: [{ id: 'msg-a' }, { id: 'msg-b' }] },
      });

      // msg-a: unregistered sender → null
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({ from: 'stranger@x.com', bodyText: 'https://example.com' })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: null, error: { message: 'Not found' } });

      // msg-b: valid registered sender
      mockGmailMessagesGet.mockResolvedValueOnce(
        makeGmailMessage({
          from: 'vasikarla.satish@gmail.com',
          bodyText: 'https://valid.example.com',
        })
      );
      mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'user-123' }, error: null });

      const results = await fetchUnreadEmails();

      expect(results).toHaveLength(1);
      expect(results[0].senderEmail).toBe('vasikarla.satish@gmail.com');
    });

    it('processes multiple valid emails and returns all of them', async () => {
      mockGmailMessagesList.mockResolvedValueOnce({
        data: { messages: [{ id: 'msg-1' }, { id: 'msg-2' }] },
      });

      for (let i = 1; i <= 2; i++) {
        mockGmailMessagesGet.mockResolvedValueOnce(
          makeGmailMessage({
            from: 'vasikarla.satish@gmail.com',
            subject: `Link ${i}`,
            bodyText: `https://link${i}.example.com`,
          })
        );
        mockSupabaseSingle.mockResolvedValueOnce({ data: { id: 'user-123' }, error: null });
      }

      const results = await fetchUnreadEmails();
      expect(results).toHaveLength(2);
    });

    // -----------------------------------------------------------------------
    // Auth error scenarios
    // -----------------------------------------------------------------------
    it('throws a descriptive error when the OAuth grant is invalid (token revoked)', async () => {
      mockGmailMessagesList.mockRejectedValueOnce(
        new Error('invalid_grant: Token has been expired or revoked')
      );

      await expect(fetchUnreadEmails()).rejects.toThrow(
        'Gmail authentication expired. Please re-authenticate at /setup/gmail'
      );
    });

    it('throws a descriptive error when no Gmail tokens are stored', async () => {
      mockSetupGmailClient.mockRejectedValueOnce(
        new Error('No stored tokens found. User needs to authenticate.')
      );

      await expect(fetchUnreadEmails()).rejects.toThrow(
        'Gmail not connected. Please authenticate at /setup/gmail'
      );
    });

    it('throws a descriptive error when stored Gmail tokens have expired', async () => {
      mockSetupGmailClient.mockRejectedValueOnce(
        new Error('Gmail tokens have expired. Please re-authenticate at /setup/gmail')
      );

      await expect(fetchUnreadEmails()).rejects.toThrow(
        'Gmail tokens expired. Please re-authenticate at /setup/gmail'
      );
    });

    it('re-throws unrecognised errors without wrapping them', async () => {
      const originalError = new Error('Some unexpected Gmail API error');
      mockSetupGmailClient.mockRejectedValueOnce(originalError);

      await expect(fetchUnreadEmails()).rejects.toThrow('Some unexpected Gmail API error');
    });
  });
});
