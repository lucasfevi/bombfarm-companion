import path from 'node:path';
import { test, expect } from '@playwright/test';
import { importedRoster, largeRoster, seedLocalStorage } from './fixtures/seed';

const sampleSave = path.join(process.cwd(), 'e2e/fixtures/sample-save.json');

test.describe('Phases page', () => {
  test('loads phase intel and top nav', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/farm');

    await expect(page.getByRole('link', { name: /^Farm$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Planner$/i })).toBeVisible();

    const navLinks = page.getByRole('navigation', { name: 'Main sections' }).getByRole('link');
    await expect(navLinks.first()).toHaveText(/^Planner$/i);
    await expect(navLinks.nth(1)).toHaveText(/^Farm$/i);
    await expect(page.getByRole('heading', { name: /^Map$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Economy$/i, level: 2 })).toBeVisible();
    await expect(page.getByLabel(/^Difficulty$/i)).toBeVisible();
    await expect(page.getByLabel(/^Map$/i)).toBeVisible();
    await expect(page.getByText(/First Strike · #1/i)).toBeVisible();
  });

  test('difficulty and map dropdowns update phase intel', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/farm');

    // DS Select is a Base UI combobox (button), not a native <select>.
    await page.getByLabel(/^Difficulty$/i).click();
    await page.getByRole('option', { name: /^Hard$/i }).click();
    await page.getByLabel(/^Map$/i).click();
    await page.getByRole('option', { name: '1-1 · First Strike' }).click();
    await expect(page.getByText(/First Strike · #151/i)).toBeVisible();

    const view = await page.evaluate(() => {
      const raw = localStorage.getItem('bf-hp-phases-view-v1');
      return raw ? JSON.parse(raw) : null;
    });
    expect(view?.phase).toBe(151);
  });

  test('import from the shell refreshes phases roster intel', async ({ page }) => {
    await seedLocalStorage(page, { heroes: [], lang: 'en' });
    await page.goto('/farm');

    await expect(page.getByText(/Import heroes in the Planner/i)).toBeVisible();

    await page.getByRole('button', { name: /^Import/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('input[type="file"]').setInputFiles(sampleSave);
    await expect(page.getByRole('dialog').getByText('Cora')).toBeVisible();
    await page.getByRole('button', { name: /import \d+ hero/i }).click();
    await expect(page.getByRole('dialog')).toBeHidden();

    await expect(page.getByText(/Combined sustained DPS/i)).toBeVisible();
    await expect(page.getByText(/Import heroes in the Planner to see/i)).toBeHidden();
  });

  test('your hero uses the planner switcher and squad table reflects casa slots', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/farm');

    await expect(page.getByRole('heading', { name: /^Your hero$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: /switch hero/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Top 9 by solo DPS/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^Name$/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^DPS$/i })).toBeVisible();
  });

  test('squad row count follows account slots (6 vs default 9)', async ({ page }) => {
    const elevenHeroes = largeRoster.heroes.slice(0, 11);
    const baseAccount = largeRoster.account!;

    await seedLocalStorage(page, {
      ...largeRoster,
      heroes: elevenHeroes,
      account: { ...baseAccount, slots: 6 },
      lang: 'en',
    });
    await page.goto('/farm');

    const sixSlotHeading = page.getByRole('heading', { name: /Top 6 by solo DPS/i, level: 2 });
    await expect(sixSlotHeading).toBeVisible();
    const sixSlotTable = sixSlotHeading.locator('xpath=following::table[1]');
    await expect(sixSlotTable.locator('tbody tr')).toHaveCount(6);

    const { slots: _omit, ...accountWithoutSlots } = baseAccount;
    await seedLocalStorage(page, {
      ...largeRoster,
      heroes: elevenHeroes,
      account: accountWithoutSlots,
      lang: 'en',
    });
    await page.goto('/farm');

    const nineSlotHeading = page.getByRole('heading', { name: /Top 9 by solo DPS/i, level: 2 });
    await expect(nineSlotHeading).toBeVisible();
    const nineSlotTable = nineSlotHeading.locator('xpath=following::table[1]');
    await expect(nineSlotTable.locator('tbody tr')).toHaveCount(9);
  });
});
