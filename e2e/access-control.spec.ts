import { test, expect } from '@playwright/test';

test.describe('Access Control', () => {
    test('should redirect unauthenticated users asking for dashboard to login', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
    });
});
