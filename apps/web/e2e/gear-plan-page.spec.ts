import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

test.describe('Gear plan page', () => {
  test('loads the page landmark and marks nav active', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/gear-plan');

    await expect(page.getByRole('region', { name: 'Roster gear plan' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Gear plan$/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: /^Planner$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Phases$/i })).toBeVisible();
  });

  test('empty roster shows empty state without Optimize', async ({ page }) => {
    await seedLocalStorage(page, { heroes: [], lang: 'en' });
    await page.goto('/gear-plan');

    await expect(page.getByRole('heading', { name: /Import heroes first/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Optimize$/i })).toHaveCount(0);
  });
});
