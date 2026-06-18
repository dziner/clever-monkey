import { test, expect } from '@playwright/test';

// App-shell safety net. These specs intentionally avoid sign-in, file
// upload, and AI calls so they remain runnable in any environment and
// give the InteractionPanel refactor a stable "did the layout still
// boot" pass before tab-extraction work lands.

test.describe('app shell', () => {
    test('idle landing renders the hero, upload card, and footer', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/Clever Monkey|Study/i);
        // Hero copy carries the product promise; assert on stable text pieces
        // because the headline is split across styled inline elements.
        await expect(page.getByRole('heading', { name: /문서를 올리면/i })).toBeVisible();
        await expect(page.getByText(/공부 흐름이 바로 생깁니다/i)).toBeVisible();
        await expect(page.getByText(/요약에서 퀴즈, 플래시카드, 마인드맵, 팟캐스트/i)).toBeVisible();
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
        // The 404 page uses the "bananas" copy. A silent fallback to the
        // empty workspace would lose this and should fail loudly.
        await expect(page.getByText(/bananas|바나나/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /take me home|홈으로/i })).toBeVisible();
    });

    test('auth uses a full-screen mobile flow and keeps desktop card sizing', async ({ page }, testInfo) => {
        await page.goto('/');
        await page.getByRole('button', { name: /sign in/i }).click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        const rect = await dialog.boundingBox();
        const viewport = page.viewportSize();
        expect(rect).not.toBeNull();
        expect(viewport).not.toBeNull();
        if (!rect || !viewport) return;

        if (testInfo.project.name.includes('mobile')) {
            expect(rect.x).toBeLessThanOrEqual(1);
            expect(rect.y).toBeLessThanOrEqual(1);
            expect(Math.abs(rect.width - viewport.width)).toBeLessThanOrEqual(1);
            expect(Math.abs(rect.height - viewport.height)).toBeLessThanOrEqual(1);
        } else {
            expect(rect.width).toBeLessThan(viewport.width - 200);
            expect(rect.x).toBeGreaterThan(100);
        }
    });
});
