import path from 'node:path';
import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

const INVENTORY_VIEW_KEY = 'bf-hp-inventory-view-v1';
const IMPORTED_AT = 1_700_000_000_000;
const CAPTURE = path.join(
  process.cwd(),
  '../../packages/domain/tests/fixtures/sheet-math/save-20260819-11882-7heroes.json',
);
const parsed = parseSaveFile(
  JSON.parse(readFileSync(CAPTURE, 'utf8')) as Record<string, unknown>,
  [],
);

const PHONE = { width: 380, height: 740 };
const ROUTES = ['/', '/heroes', '/farm', '/optimizer', '/inventory', '/skills', '/account', '/download', '/privacy'];

async function seedFullAccount(page: Page, lang: 'en' | 'pt'): Promise<void> {
  await seedLocalStorage(page, {
    ...importedRoster,
    lang,
    inventory: { version: 1, importedAt: IMPORTED_AT, items: parsed.inventory },
  });
  await page.addInitScript(
    ({ key, stored }) => {
      localStorage.setItem(key, JSON.stringify(stored));
    },
    { key: INVENTORY_VIEW_KEY, stored: { version: 1, importedAt: IMPORTED_AT, items: parsed.inventoryView } },
  );
}

const documentWidth = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth);

test.describe('site header at phone width', () => {
  test.use({ viewport: PHONE });

  for (const lang of ['en', 'pt'] as const) {
    for (const route of ROUTES) {
      test(`${route} does not scroll sideways (${lang})`, async ({ page }) => {
        await seedFullAccount(page, lang);
        await page.goto(route);
        await expect(page.getByTestId('header-menu')).toBeVisible();

        expect(await documentWidth(page)).toBeLessThanOrEqual(PHONE.width + 1);
      });
    }
  }

  test('the tabs scroll inside their own strip and the active one is brought into view', async ({ page }) => {
    await seedFullAccount(page, 'en');
    await page.goto('/account');

    const nav = page.getByRole('navigation', { name: 'Main sections' });
    const strip = nav.locator('xpath=..');
    const overflow = await strip.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(overflow.scroll).toBeGreaterThan(overflow.client);

    await expect(nav.getByRole('link', { name: 'Account' })).toBeInViewport();
  });

  test('every header action is reachable from the menu', async ({ page }) => {
    await seedFullAccount(page, 'en');
    await page.goto('/farm');

    await expect(page.getByTestId('header-download-cta')).toHaveCount(0);
    await expect(page.getByTestId('referral-topbar')).toHaveCount(0);

    await page.getByTestId('header-menu').click();
    const menu = page.getByTestId('header-menu-popup');
    await expect(menu.getByRole('menuitem', { name: /download/i })).toHaveAttribute('href', '/download');
    await expect(menu.getByRole('menuitem', { name: /import/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /referral/i })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: /coffee/i })).toHaveAttribute('href', /buymeacoffee/);
    await expect(menu.getByRole('menuitemradio', { name: 'English' })).toBeChecked();

    await menu.getByRole('menuitemradio', { name: 'Português' }).click();
    await expect(page.getByRole('navigation', { name: 'Seções principais' })).toBeVisible();
  });

  test('the import item opens the import dialog', async ({ page }) => {
    await seedFullAccount(page, 'en');
    await page.goto('/farm');

    await page.getByTestId('header-menu').click();
    await page.getByTestId('header-menu-import').click();

    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test.describe('with clipboard access', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test('the referral item copies the code and closes the menu', async ({ page }) => {
      await seedFullAccount(page, 'en');
      await page.goto('/farm');

      await page.getByTestId('header-menu').click();
      await page.getByTestId('header-menu-referral').click();

      await expect(page.getByRole('status').filter({ hasText: /referral code copied/i })).toBeVisible();
      await expect(page.getByTestId('header-menu-popup')).toBeHidden();
    });
  });
});

test.describe('site header above phone width', () => {
  test('keeps every action in the bar', async ({ page }) => {
    await seedFullAccount(page, 'en');
    await page.goto('/farm');

    await expect(page.getByTestId('header-download-cta')).toBeVisible();
    await expect(page.getByTestId('referral-topbar')).toBeVisible();
    await expect(page.getByTestId('header-menu')).toHaveCount(0);
  });
});
