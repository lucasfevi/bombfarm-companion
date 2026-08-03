import path from 'node:path';
import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage } from './fixtures/seed';

const sampleSave = path.join(process.cwd(), 'e2e/fixtures/sample-save.json');

test.describe('Phases page', () => {
  test('loads phase intel and top nav', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/phases');

    await expect(page.getByRole('link', { name: /^Phases$/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Planner$/i })).toBeVisible();

    const navLinks = page.getByRole('navigation', { name: 'Main sections' }).getByRole('link');
    await expect(navLinks.first()).toHaveText(/^Planner$/i);
    await expect(navLinks.nth(1)).toHaveText(/^Phases$/i);
    await expect(page.getByRole('heading', { name: /^Map$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('heading', { name: /^Economy$/i, level: 2 })).toBeVisible();
    await expect(page.getByLabel(/^Difficulty$/i)).toBeVisible();
    await expect(page.getByLabel(/^Map$/i)).toBeVisible();
    await expect(page.getByText(/First Strike · #1/i)).toBeVisible();
  });

  test('difficulty and map dropdowns update phase intel', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/phases');

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
    await page.goto('/phases');

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

  test('your hero uses the planner switcher and top 9 is a roster table', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/phases');

    await expect(page.getByRole('heading', { name: /^Your hero$/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: /switch hero/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Top 9 by solo DPS/i, level: 2 })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^Name$/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /^DPS$/i })).toBeVisible();
  });
});
