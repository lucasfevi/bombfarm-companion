import path from 'node:path';
import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  readForgeFloorValue,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

const sampleSave = path.join(process.cwd(), 'e2e/fixtures/sample-save.json');

function seedWithForgeFloor(floor: number) {
  const base = gearPlanFixtureSeed('en');
  return { ...base, account: { ...base.account!, forgeFloor: floor } };
}

test.describe('Team plan min forge', () => {
  test('stepper increments min forge in the UI', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    const increment = page.getByRole('button', { name: /Min forge \(\+\) \+/i });
    for (let i = 0; i < 5; i++) await increment.click();
    await expect(await readForgeFloorValue(page)).toBe('15');
  });

  test('loads persisted min forge and clamps out of range', async ({ page }) => {
    await seedLocalStorage(page, seedWithForgeFloor(15));
    await gotoGearPlan(page);
    await expect(await readForgeFloorValue(page)).toBe('15');

    await seedLocalStorage(page, seedWithForgeFloor(99));
    await page.goto('/team-plan');
    await expect(await readForgeFloorValue(page)).toBe('15');

    await seedLocalStorage(page, seedWithForgeFloor(-1));
    await page.goto('/team-plan');
    await expect(await readForgeFloorValue(page)).toBe('0');
  });

  test('changing min forge marks plan stale', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await page.getByRole('button', { name: /Min forge \(\+\) \+/i }).click();
    await expect(page.getByText(/Inputs changed since this plan/i)).toBeVisible();
  });

  test('import does not reset min forge', async ({ page }) => {
    await seedLocalStorage(page, seedWithForgeFloor(12));
    await gotoGearPlan(page);
    await expect(await readForgeFloorValue(page)).toBe('12');

    await page.getByRole('button', { name: /^Import/i }).click();
    await page.locator('input[type="file"]').setInputFiles(sampleSave);
    await page.getByRole('button', { name: /import \d+ hero/i }).click();
    await page.goto('/team-plan');
    await expect(await readForgeFloorValue(page)).toBe('12');
  });
});
