import { test, expect } from '@playwright/test';

test.describe('Debug Page', () => {
    test('should load debug page', async ({ page }) => {
        await page.goto('/debug');
        await expect(page.getByRole('heading', { name: 'Auth Debug Page' })).toBeVisible();
        // Wait for logs to appear which indicates JS is running
        await expect(page.getByText('Debug page mounted')).toBeVisible();
    });
});
