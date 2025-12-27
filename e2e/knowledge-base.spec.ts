import { test, expect } from '@playwright/test';

test.describe('Knowledge Base', () => {
    test('should redirect unauthenticated users to login', async ({ page }) => {
        await page.goto('/knowledge-base');
        await expect(page).toHaveURL(/.*login/);
    });
});
