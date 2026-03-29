import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUserInterestProfile } from './interest-profile';

function makeMockSupabase(kbItems: any[], recentEntries: any[]) {
  const supabase: any = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table !== 'knowledgebase') return {};

      // Track which call this is via a closure counter
      const callIndex = supabase._callCount++;
      if (callIndex === 0) {
        // First call: category query
        const chain: any = {};
        chain.select = vi.fn().mockReturnValue(chain);
        chain.eq = vi.fn().mockReturnValue(chain);
        chain.then = (cb: any) => Promise.resolve({ data: kbItems, error: null }).then(cb);
        return chain;
      }
      // Second call: recent summaries query
      const chain: any = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.eq = vi.fn().mockReturnValue(chain);
      chain.neq = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.then = (cb: any) => Promise.resolve({ data: recentEntries, error: null }).then(cb);
      return chain;
    }),
    _callCount: 0,
  };
  return supabase;
}

describe('getUserInterestProfile', () => {
  it('returns empty profile when user has no KB entries', async () => {
    const supabase = makeMockSupabase([], []);

    const profile = await getUserInterestProfile('u1', supabase);

    expect(profile.categories).toEqual([]);
    expect(profile.recentSummaries).toEqual([]);
    expect(profile.topKeywords).toEqual([]);
  });

  it('counts categories and sorts by weight descending', async () => {
    const kbItems = [
      { category: 'AI' },
      { category: 'AI' },
      { category: 'AI' },
      { category: 'Science' },
      { category: 'Science' },
      { category: 'Technology' },
    ];

    const supabase = makeMockSupabase(kbItems, []);
    const profile = await getUserInterestProfile('u1', supabase);

    expect(profile.categories).toEqual([
      { name: 'AI', weight: 3 },
      { name: 'Science', weight: 2 },
      { name: 'Technology', weight: 1 },
    ]);
  });

  it('ignores entries with null category', async () => {
    const kbItems = [
      { category: 'AI' },
      { category: null },
      { category: undefined },
    ];

    const supabase = makeMockSupabase(kbItems, []);
    const profile = await getUserInterestProfile('u1', supabase);

    expect(profile.categories).toEqual([{ name: 'AI', weight: 1 }]);
  });

  it('builds recentSummaries from summary_text and key_points', async () => {
    const recentEntries = [
      { summary_text: 'AI advances', summary_json: { key_points: ['point1', 'point2', 'point3'] } },
      { summary_text: 'Quantum computing', summary_json: null },
      { summary_text: 'Blockchain trends', summary_json: { key_points: ['kp1'] } },
    ];

    const supabase = makeMockSupabase([], recentEntries);
    const profile = await getUserInterestProfile('u1', supabase);

    expect(profile.recentSummaries).toHaveLength(3);
    // First entry: summary_text + first 2 key_points
    expect(profile.recentSummaries[0]).toBe('AI advances (point1; point2)');
    // Second entry: just summary_text (no key_points)
    expect(profile.recentSummaries[1]).toBe('Quantum computing');
    // Third entry: summary_text + single key_point
    expect(profile.recentSummaries[2]).toBe('Blockchain trends (kp1)');
  });

  it('limits recentSummaries to 5', async () => {
    const recentEntries = Array.from({ length: 10 }, (_, i) => ({
      summary_text: `Summary ${i}`,
      summary_json: null,
    }));

    const supabase = makeMockSupabase([], recentEntries);
    const profile = await getUserInterestProfile('u1', supabase);

    expect(profile.recentSummaries).toHaveLength(5);
  });

  it('topKeywords is top 5 category names', async () => {
    const kbItems = [
      { category: 'A' }, { category: 'A' }, { category: 'A' }, { category: 'A' }, { category: 'A' }, { category: 'A' },
      { category: 'B' }, { category: 'B' }, { category: 'B' }, { category: 'B' }, { category: 'B' },
      { category: 'C' }, { category: 'C' }, { category: 'C' }, { category: 'C' },
      { category: 'D' }, { category: 'D' }, { category: 'D' },
      { category: 'E' }, { category: 'E' },
      { category: 'F' },
    ];

    const supabase = makeMockSupabase(kbItems, []);
    const profile = await getUserInterestProfile('u1', supabase);

    expect(profile.topKeywords).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(profile.topKeywords).not.toContain('F');
  });
});
