import { test, expect } from '@playwright/test';

// App-shell safety net. These specs intentionally avoid sign-in, file
// upload, and AI calls so they remain runnable in any environment and
// give the InteractionPanel refactor a stable "did the layout still
// boot" pass before tab-extraction work lands.

test.describe('app shell', () => {
    test('idle landing renders the hero, upload card, and footer', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Clever Monkey|Study/i);
        // Hero copy carries the brand voice; if it disappears, the
        // landing page composition has regressed.
        await expect(page.getByText(/cleverer than yours/i)).toBeVisible();
        // Privacy assurance is part of the trust framing.
        await expect(page.getByText(/본인만 볼 수 있습니다|files are private/i)).toBeVisible();
        // Trust footer with both legal links.
        await expect(page.getByRole('link', { name: /privacy|개인정보/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /terms|이용약관/i })).toBeVisible();
    });

    test('privacy page renders with a back link', async ({ page }) => {
        await page.goto('/privacy');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        // Provisional notice must always be present until counsel review
        // ships — the legal page explicitly flags its pre-review state.
        await expect(page.getByText(/잠정|provisional/i)).toBeVisible();
    });

    test('terms page renders with a back link', async ({ page }) => {
        await page.goto('/terms');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.getByText(/잠정|provisional/i)).toBeVisible();
    });

    test('unknown route renders the friendly 404, not the empty workspace', async ({ page }) => {
        await page.goto('/this-route-does-not-exist');
        // The 404 page uses the "bananas" copy — a silent redirect back
        // to /admin or /study would lose this and we want the test to
        // fail loudly if that regression ever returns.
        await expect(page.getByText(/bananas|바나나/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /take me home|홈으로/i })).toBeVisible();
    });
});
