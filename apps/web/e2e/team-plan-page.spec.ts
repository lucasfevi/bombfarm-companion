import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

test.describe('Optimizer page', () => {
  test('loads the page landmark and marks nav active', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/optimizer');

    await expect(page.getByRole('region', { name: 'Optimizer' })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Optimizer$/i })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(page.getByRole('link', { name: /^Planner$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Farm$/i })).toBeVisible();
  });

  test('empty roster shows empty state without Build team plan', async ({ page }) => {
    await seedLocalStorage(page, { heroes: [], lang: 'en' });
    await page.goto('/optimizer');

    await expect(page.getByRole('heading', { name: /Import heroes first/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Build team plan$/i })).toHaveCount(0);
  });
});

test.describe('/team-plan redirect stub', () => {
  test('sends a link shared before the rename to /optimizer, without a Back trap', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/farm');
    await page.goto('/team-plan');

    await expect(page).toHaveURL(/\/optimizer$/);
    await expect(page.getByRole('region', { name: 'Optimizer' })).toBeVisible();

    // `router.replace`, not `push`: Back must reach whatever came before the old URL, or the
    // stub redirects again and the visitor cannot leave.
    await page.goBack();
    await expect(page).toHaveURL(/\/farm$/);
  });
});
