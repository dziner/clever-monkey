import { test, expect } from '@playwright/test';

test('app loads and shows idle state', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Clever Monkey|Study/i);
});
