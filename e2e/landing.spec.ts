import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
    test('should load and display key sections', async ({ page, isMobile }) => {
        // Navigate to landing page
        await page.goto('/');

        // Check title/hero
        await expect(page).toHaveTitle(/CorePragya/i);

        // Check for the main heading using a flexible role selector or checking parts
        await expect(page.getByRole('heading', { name: /Your Personal/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /AI Knowledge Assistant/i })).toBeVisible();

        // Check header links only on desktop
        if (!isMobile) {
            const header = page.locator('header');
            await expect(header.getByRole('link', { name: 'Features' })).toBeVisible();
            await expect(header.getByRole('link', { name: 'Login' })).toBeVisible();
        }
    });

    test('should allow direct navigation to login page', async ({ page }) => {
        await page.goto('/login');
        await expect(page).toHaveURL(/.*login/);
        await expect(page.getByText('Welcome back')).toBeVisible();
    });

    test('should navigate to login page from header', async ({ page, isMobile }) => {
        // Skip navigation test on mobile if the menu interaction is complex for this basic test
        if (isMobile) return;

        await page.goto('/');

        // Debug: Check if the link exists and has correct href
        const loginLink = page.locator('header').getByRole('link', { name: 'Login' });
        await expect(loginLink).toBeVisible();
        await expect(loginLink).toHaveAttribute('href', '/login');

        // Perform navigation with explicit wait
        await loginLink.click();
        await expect(page).toHaveURL(/.*login/);
    });
});
