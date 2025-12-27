import { test, expect } from '@playwright/test';

test.describe('Additional Pages Access Control', () => {
    const protectedPages = [
        '/chatbot',
        '/knowledge-graph',
        '/personal-rag-bot'
    ];

    for (const path of protectedPages) {
        test(`should redirect unauthenticated users asking for ${path} to login`, async ({ page }) => {
            await page.goto(path);
            await expect(page).toHaveURL(/.*login/, { timeout: 10000 });
        });
    }
});
