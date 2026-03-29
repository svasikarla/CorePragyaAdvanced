import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Supabase Auth
    await page.route('**/auth/v1/user', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'test-user-id',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'test@example.com',
        }),
      });
    });

    // Mock knowledge base entries (used by stats, charts, insights)
    await page.route('**/rest/v1/knowledgebase*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { id: '1', title: 'AI Research', summary_text: 'Deep learning advances', category: 'AI', source_type: 'url', created_at: new Date().toISOString() },
          { id: '2', title: 'Quantum Paper', summary_text: 'Quantum computing breakthroughs', category: 'Science', source_type: 'pdf', created_at: new Date().toISOString() },
          { id: '3', title: 'Tech Startup News', summary_text: 'Startup funding trends', category: 'Technology', source_type: 'url', created_at: new Date().toISOString() },
        ]),
      });
    });

    // Mock trending feed API
    await page.route('/api/trending-feed*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          articles: [
            { id: 'a1', title: 'Breaking AI News', summary_text: 'AI is transforming healthcare', source_ref: 'http://example.com/1', source_name: 'TechCrunch', category: 'AI', relevance_score: 9, composite_score: 8.5, is_new: true, published_at: new Date().toISOString() },
            { id: 'a2', title: 'Quantum Computing Update', summary_text: 'New quantum processor announced', source_ref: 'http://example.com/2', source_name: 'Nature', category: 'Science', relevance_score: 7, composite_score: 6.8, is_new: false, published_at: new Date().toISOString() },
          ],
          total: 2,
          has_more: false,
          page: 1,
          categories: ['AI', 'Science'],
        }),
      });
    });

    // Mock generate-insights API
    await page.route('/api/generate-insights', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          insights: [
            'Your knowledge base shows strong focus on AI and quantum computing.',
            'Consider exploring the intersection of AI and healthcare.',
          ],
          trending_topics: [
            { name: 'AI Healthcare', description: 'Growing field', relevance: 9 },
          ],
        }),
      });
    });

    // Mock embedding stats
    await page.route('/api/embedding-stats*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ total_embeddings: 15, coverage: 0.8 }),
      });
    });
  });

  const gotoWithAuth = async (page: any) => {
    const fakeToken = 'fake-access-token';
    const fakeRefresh = 'fake-refresh-token';
    await page.goto(`/dashboard#access_token=${fakeToken}&refresh_token=${fakeRefresh}&expires_in=3600&token_type=bearer&type=recovery`);
  };

  test('should display greeting and stat cards', async ({ page }) => {
    await gotoWithAuth(page);

    // Greeting should be visible
    await expect(page.locator('text=/Good (Morning|Afternoon|Evening)/i')).toBeVisible();

    // Stat cards should show
    await expect(page.getByText('Total Entries')).toBeVisible();
  });

  test('should display trending news feed with articles', async ({ page }) => {
    await gotoWithAuth(page);

    // Trending feed section should be visible
    await expect(page.getByText('Trending News Feed')).toBeVisible();

    // Article titles should appear
    await expect(page.getByText('Breaking AI News')).toBeVisible();
    await expect(page.getByText('Quantum Computing Update')).toBeVisible();
  });

  test('should show article summaries in trending feed', async ({ page }) => {
    await gotoWithAuth(page);

    // Summaries should be visible under article titles
    await expect(page.getByText('AI is transforming healthcare')).toBeVisible();
    await expect(page.getByText('New quantum processor announced')).toBeVisible();
  });

  test('should display knowledge analytics without excessive scrolling', async ({ page }) => {
    test.skip(page.viewportSize()?.width !== undefined && page.viewportSize()!.width < 1280,
      'Side-by-side layout only applies on xl screens');

    await gotoWithAuth(page);

    // Analytics section should be visible — on xl, it sits beside the trending feed
    const analyticsHeading = page.getByText('Knowledge Analytics');
    await expect(analyticsHeading).toBeVisible();

    // Check it's in the viewport without scrolling (roughly)
    const box = await analyticsHeading.boundingBox();
    if (box) {
      const viewportHeight = page.viewportSize()?.height || 720;
      // Analytics heading should be within 1.5 viewport heights from top
      expect(box.y).toBeLessThan(viewportHeight * 1.5);
    }
  });

  test('should show AI insights section', async ({ page }) => {
    await gotoWithAuth(page);

    // AI Insights section
    await expect(page.getByText('AI Insights')).toBeVisible();
  });
});
