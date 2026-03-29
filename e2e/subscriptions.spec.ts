import { test, expect } from '@playwright/test';

test.describe('Subscriptions UI', () => {

    test.beforeEach(async ({ page }) => {
        // 1. Mock Supabase Auth (User Session) to bypass real login
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

        // 2. Mock Initial Fetch of Feeds
        await page.route('**/user_subscriptions?select=*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    {
                        id: 'sub-1',
                        user_id: 'test-user-id',
                        rss_feed_id: 'feed-1',
                        rss_feeds: {
                            id: 'feed-1',
                            name: 'Existing Feed',
                            url: 'https://existing.com/rss'
                        }
                    }
                ]),
            });
        });

        // 3. Mock suggest-feeds API to avoid LLM calls in tests
        await page.route('**/api/suggest-feeds', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ success: true, topics_analyzed: ['Technology'], suggestions: [] }),
            });
        });
    });

    const gotoWithAuth = async (page: any) => {
        const fakeToken = 'fake-access-token';
        const fakeRefresh = 'fake-refresh-token';
        await page.goto(`/knowledge-base/subscriptions#access_token=${fakeToken}&refresh_token=${fakeRefresh}&expires_in=3600&token_type=bearer&type=recovery`);
    };

    test('should render active subscriptions gracefully', async ({ page }) => {
        await gotoWithAuth(page);

        // Verify page titles
        await expect(page.getByRole('heading', { name: 'Intelligence Feeds' })).toBeVisible();
        await expect(page.getByText('Add Specific Feed')).toBeVisible();

        // Verify the mocked existing feed is rendered
        await expect(page.getByText('Existing Feed')).toBeVisible();
        await expect(page.getByText('https://existing.com/rss')).toBeVisible();
    });

    test('should allow a user to add a new custom feed', async ({ page }) => {
        await gotoWithAuth(page);

        // Intercept checks for existing feeds
        await page.route('**/rss_feeds?select=id&url=eq.*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([]) // Pretend it doesn't exist
            });
        });

        // Intercept inserting new feed
        await page.route('**/rss_feeds', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify([{ id: 'new-feed-99' }])
                });
            } else {
                await route.continue();
            }
        });

        // Intercept subscribing user to feed
        await page.route('**/user_subscriptions', async route => {
            if (route.request().method() === 'POST') {
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify([{ id: 'new-sub-99', user_id: 'test-user-id', rss_feed_id: 'new-feed-99' }])
                });
            } else {
                await route.continue();
            }
        });

        // Fill out the form
        await page.getByPlaceholder('e.g. Google AI Blog').fill('TechCrunch');
        await page.getByPlaceholder('https://...').fill('https://techcrunch.com/feed/');

        // Submit form
        await page.getByRole('button', { name: 'Subscribe' }).click();

        // Toasts appear successfully
        await expect(page.getByText('Successfully added to your knowledge ingestion feeds.')).toBeVisible();
    });

    test('should allow a user to delete a subscription', async ({ page }) => {
        await gotoWithAuth(page);

        // Intercept DELETE
        await page.route('**/user_subscriptions?id=eq.sub-1', async route => {
            if (route.request().method() === 'DELETE') {
                await route.fulfill({ status: 204 });
            } else {
                await route.continue();
            }
        });

        // The trash button should be present
        const deleteBtn = page.locator('.text-red-500');
        await deleteBtn.click();

        // Toast shows removal
        await expect(page.getByText('Removed custom feed.')).toBeVisible();
    });
});
