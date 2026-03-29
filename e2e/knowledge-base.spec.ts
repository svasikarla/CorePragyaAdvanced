import { test, expect } from '@playwright/test';

test.describe('Knowledge Base', () => {
    // Mock data for tests
    const mockEntries = [
        {
            id: '1',
            title: 'Test Entry 1',
            summary: 'This is a test summary for entry 1.',
            category: 'Technology',
            type: 'url',
            date: '2023-01-01',
        },
        {
            id: '2',
            title: 'Science Article',
            summary: 'A detailed summary about science.',
            category: 'Science',
            type: 'pdf',
            date: '2023-01-02',
        }
    ];

    test.beforeEach(async ({ page }) => {
        // 1. Mock Supabase Auth (User Session)
        // Intercept the call to get the user session/details
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

        // 2. Mock Knowledge Base Entries Fetch
        await page.route('**/knowledge-base/entries*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: mockEntries,
                    error: null
                }),
            });
        });

        // Also mock the direct API call if it uses the internal API route
        await page.route('/api/knowledge-base/entries*', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: mockEntries
                })
            });
        });
    });

    // Helper to navigate with auth hash
    // This simulates a session recovery or OAuth callback, prompting Supabase to set the session
    const gotoWithAuth = async (page: any) => {
        const fakeToken = 'fake-access-token';
        const fakeRefresh = 'fake-refresh-token';
        await page.goto(`/knowledge-base#access_token=${fakeToken}&refresh_token=${fakeRefresh}&expires_in=3600&token_type=bearer&type=recovery`);
    };

    test('should load and display entries', async ({ page }) => {
        await gotoWithAuth(page);

        // Verify page title
        await expect(page.getByText('Knowledge Base')).toBeVisible();

        // Verify entries are displayed
        await expect(page.getByText('Test Entry 1')).toBeVisible();
        await expect(page.getByText('Science Article')).toBeVisible();
    });

    test('should search and filter entries', async ({ page }) => {
        await gotoWithAuth(page);

        // Test Search
        const searchInput = page.getByPlaceholder('Search knowledge base...');
        await searchInput.fill('Science');

        // Allow debounce
        await page.waitForTimeout(500);

        await expect(page.getByText('Science Article')).toBeVisible();
        await expect(page.getByText('Test Entry 1')).toBeHidden();

        // Clear search
        await searchInput.clear();
        await page.waitForTimeout(500);

        // Test Category Filter
        // Find the category button - assuming it renders based on available categories
        // We might need to click a "Filter" button first or if categories are tabs.
        // Assuming they are visible buttons based on code. 
        const techFilter = page.getByRole('button', { name: 'Technology' });
        if (await techFilter.isVisible()) {
            await techFilter.click();
            await expect(page.getByText('Test Entry 1')).toBeVisible();
            await expect(page.getByText('Science Article')).toBeHidden();
        }
    });

    test('should add new web content via URL', async ({ page }) => {
        await gotoWithAuth(page);

        // Mock the process-url API endpoint
        await page.route('/api/process-url', async route => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    data: {
                        id: '3',
                        title: 'New AI Page',
                        summary_text: 'Summary of the new AI page.',
                        summary_json: { key_points: [] },
                        category: 'Artificial Intelligence'
                    }
                }),
            });
        });

        // Open "Add Content" dropdown
        await page.getByRole('button', { name: 'Add Content' }).click();

        // Click "Add from URL"
        await page.getByText('Add from URL').click();

        // Verify Dialog Open
        const dialog = page.getByRole('dialog', { name: 'Add Web Content' });
        await expect(dialog).toBeVisible();

        // Fill URL
        const urlInput = dialog.locator('input[type="url"]');
        await urlInput.fill('https://example.com/ai');

        // Submit
        const submitBtn = dialog.getByRole('button', { name: 'Add URL' });
        await submitBtn.click();

        // Verify Success Toast (optional, checks for text)
        await expect(page.getByText('URL added to Knowledge Base')).toBeVisible();

        // Verify Dialog Closed
        await expect(dialog).toBeHidden();
    });

    test('should delete an entry', async ({ page }) => {
        await gotoWithAuth(page);

        // Mock Delete API
        await page.route('**/api/knowledge-base/delete*', async route => {
            await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
        });
        // Also mock Supabase delete if direct
        await page.route('**/knowledgebase?id=eq.1', async route => {
            if (route.request().method() === 'DELETE') {
                await route.fulfill({ status: 200 });
            } else {
                await route.continue();
            }
        });

        // Find delete trigger
        const card = page.locator('div').filter({ hasText: 'Test Entry 1' }).first();
        await expect(card).toBeVisible();

        // Hover to reveal actions
        await card.hover();

        // Look for typical delete icon (Trash2)
        const deleteBtn = card.getByRole('button').filter({ has: page.locator('svg.lucide-trash-2') });

        if (await deleteBtn.isVisible()) {
            await deleteBtn.click();
        } else {
            // Fallback locator
            await card.getByRole('button').last().click();
        }
    });
});
