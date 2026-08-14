import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

test.describe('Team plan page', () => {
  test('loads the page landmark and marks nav active', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/team-plan');

    await expect(page.getByRole('region', { name: 'Team plan' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Team plan$/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: /^Planner$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Farm$/i })).toBeVisible();
  });

  test('empty roster shows empty state without Build team plan', async ({ page }) => {
    await seedLocalStorage(page, { heroes: [], lang: 'en' });
    await page.goto('/team-plan');

    await expect(page.getByRole('heading', { name: /Import heroes first/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Build team plan$/i })).toHaveCount(0);
  });
});
