import { test, expect } from '@playwright/test';

/**
 * Trivial harness proof: static export boots without next dev.
 * Full flow coverage lives in smoke.spec.ts / visual.spec.ts.
 */
test('harness serves the static export', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Bomb Farm Companion/i);
  await expect(page.getByRole('heading', { name: /nenhum herói adicionado|no heroes added yet/i })).toBeVisible();
});
