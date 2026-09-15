import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

/**
 * The toast is one element for the whole shell. It used to live inside the planner slot, which
 * every section page hides and marks inert, so the chip copied the code on `/farm` and showed
 * nothing — the player read that as "the copy does not work here".
 */
test.describe('referral code copy', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  for (const path of ['/', '/farm', '/optimizer', '/account']) {
    test(`confirms the copy with a visible toast on ${path}`, async ({ page }) => {
      await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
      await page.goto(path);

      await page.getByTestId('referral-topbar').click();

      await expect(page.getByRole('status').filter({ hasText: /referral code copied/i })).toBeVisible();
    });
  }
});
