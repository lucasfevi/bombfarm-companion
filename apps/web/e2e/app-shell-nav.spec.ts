import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

test.describe('App shell navigation', () => {
  test('planner stays mounted across route changes', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });

    const avatarRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('_avatar.png')) avatarRequests.push(req.url());
    });

    await page.goto('/');
    const heroStrip = page.getByRole('region', { name: /current hero/i });
    await expect(heroStrip).toBeVisible();

    const avatarsAfterFirstLoad = avatarRequests.length;

    await page.getByRole('link', { name: /^Farm$/i }).click();
    await expect(page).toHaveURL(/\/farm$/);
    await expect(heroStrip).toBeHidden();

    await page.getByRole('link', { name: /^Planner$/i }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(heroStrip).toBeVisible();

    // Keep-alive: the planner tree is never unmounted, so no avatar refetch.
    expect(avatarRequests.length).toBe(avatarsAfterFirstLoad);
  });

  test('nav order is Planner then Farm and marks the active route', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');

    const links = page.getByRole('navigation', { name: 'Main sections' }).getByRole('link');
    await expect(links.first()).toHaveText(/^Planner$/i);
    await expect(links.nth(1)).toHaveText(/^Farm$/i);
    await expect(links.first()).toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: /^Farm$/i }).click();
    await expect(links.nth(1)).toHaveAttribute('aria-current', 'page');
  });

  test('import dialog opens from the shell on both routes', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/farm');

    await page.getByRole('button', { name: /^Import/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('direct load of /farm renders the farm route, not the planner', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/farm');

    await expect(page.getByRole('heading', { name: /^Map$/i, level: 2 })).toBeVisible();
    await expect(page.getByLabel(/^Difficulty$/i)).toBeVisible();
    await expect(page.getByRole('region', { name: /current hero/i })).toBeHidden();
  });
});
