import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { importedRoster, seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  setE2eForceError,
  setE2eMaxEvaluations,
  snapshotHeroesJson,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

test.describe('Gear plan page states', () => {
  test('no inventory shows empty state', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await gotoGearPlan(page);
    await expect(page.getByRole('heading', { name: /No item inventory yet/i })).toBeVisible();
  });

  test('blocked heroes without birth are named', async ({ page }) => {
    const seed = gearPlanFixtureSeed('en');
    const hero = seed.heroes[0];
    if (!hero) throw new Error('fixture hero missing');
    delete (hero as { birth?: unknown }).birth;
    await seedLocalStorage(page, seed);
    await gotoGearPlan(page);
    await clickOptimize(page);
    const blocked = page.getByRole('heading', { name: /Cannot run — missing birth stats/i }).locator(
      'xpath=ancestor::div[1]',
    );
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText(hero.name);
  });

  test('optimize without confirm leaves heroes storage unchanged', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    const before = await snapshotHeroesJson(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await page.reload();
    const after = await snapshotHeroesJson(page);
    expect(after).toBe(before);
  });

  test('runner error shows retry control', async ({ page }) => {
    await setE2eForceError(page, true);
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await expect(page.getByRole('heading', { name: /Search failed/i })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole('button', { name: /Try again/i })).toBeVisible();
  });

  test('optimizing modal can cancel the run', async ({ page }) => {
    await setE2eMaxEvaluations(page, 50_000);
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await expect(page.getByRole('dialog', { name: /Searching/i })).toBeVisible();
    await expect(page.getByText(/^Elapsed /i)).toBeVisible();
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(page.getByRole('dialog', { name: /Searching/i })).toBeHidden();
    await expect(page.getByRole('button', { name: /Run the roster gear search/i })).toBeEnabled();
  });
});
