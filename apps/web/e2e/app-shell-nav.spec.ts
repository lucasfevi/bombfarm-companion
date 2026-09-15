import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

test.describe('App shell navigation', () => {
  test('planner stays mounted across route changes', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });

    const avatarRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('_avatar.png')) avatarRequests.push(req.url());
    });

    await page.goto('/heroes');
    const heroStrip = page.getByRole('region', { name: /current hero/i });
    await expect(heroStrip).toBeVisible();

    const avatarsAfterFirstLoad = avatarRequests.length;

    await page.getByRole('link', { name: /^Farm$/i }).click();
    await expect(page).toHaveURL(/\/farm$/);
    await expect(heroStrip).toBeHidden();

    await page.getByRole('link', { name: /^Heroes$/i }).click();
    await expect(page).toHaveURL(/\/heroes$/);
    await expect(heroStrip).toBeVisible();

    // Keep-alive: the planner tree is never unmounted, so no avatar refetch.
    expect(avatarRequests.length).toBe(avatarsAfterFirstLoad);
  });

  test('nav order is Home then Heroes then Farm and marks the active route', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/heroes');

    const links = page.getByRole('navigation', { name: 'Main sections' }).getByRole('link');
    await expect(links).toHaveText([
      /^Home$/i,
      /^Heroes$/i,
      /^Farm$/i,
      /^Optimizer$/i,
      /^Inventory$/i,
      /^Account$/i,
    ]);
    await expect(links.nth(1)).toHaveAttribute('aria-current', 'page');
    await expect(links.first()).not.toHaveAttribute('aria-current', 'page');

    await page.getByRole('link', { name: /^Farm$/i }).click();
    await expect(links.nth(2)).toHaveAttribute('aria-current', 'page');
    await expect(links.nth(1)).not.toHaveAttribute('aria-current', 'page');
  });

  test('header links fetch a route payload on hover, not on page load', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });

    const payloadRequests: string[] = [];
    page.on('request', (req) => {
      if (/\.txt(\?|$)/.test(req.url())) payloadRequests.push(new URL(req.url()).pathname);
    });

    await page.goto('/planner');
    await expect(page.getByRole('region', { name: /current hero/i })).toBeVisible();
    await page.waitForTimeout(1000);
    expect(payloadRequests).toEqual([]);

    await page.getByRole('link', { name: /^Farm$/i }).hover();
    await expect.poll(() => payloadRequests).toContain('/farm.txt');
    expect(payloadRequests).not.toContain('/optimizer.txt');
  });

  test('import dialog opens from the shell on both routes', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/farm');

    await page.getByRole('button', { name: /^Import/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('direct load of / renders Home and hides the planner', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Your account, at a glance' }),
    ).toBeVisible();
    await expect(page.getByRole('region', { name: /current hero/i })).toBeHidden();

    const links = page.getByRole('navigation', { name: 'Main sections' }).getByRole('link');
    await expect(links.first()).toHaveText(/^Home$/i);
    await expect(links.first()).toHaveAttribute('aria-current', 'page');
    await expect(links.nth(1)).not.toHaveAttribute('aria-current', 'page');
  });

  test('direct load of /farm renders the farm route, not the planner', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/farm');

    await expect(page.getByRole('heading', { name: /^Map$/i, level: 2 })).toBeVisible();
    await expect(page.getByLabel(/^Difficulty$/i)).toBeVisible();
    await expect(page.getByRole('region', { name: /current hero/i })).toBeHidden();
  });
});

test.describe('/planner redirect stub', () => {
  test('sends a link shared before the rename to /heroes, without a Back trap', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/farm');
    await page.goto('/planner');

    await expect(page).toHaveURL(/\/heroes$/);
    await expect(page.getByRole('region', { name: /current hero/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Heroes$/i })).toHaveAttribute(
      'aria-current',
      'page',
    );

    // `router.replace`, not `push`: Back must reach whatever came before the old URL, or the
    // stub redirects again and the visitor cannot leave.
    await page.goBack();
    await expect(page).toHaveURL(/\/farm$/);
  });
});
