import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  readForgeFloorValue,
  scopePanel,
  setAccountForgeFloor,
  waitForAccountForgeFloor,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

test.describe('Gear plan hero scope', () => {
  test('two Korin rows are distinguishable by accessible name', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);

    const korinRows = scopePanel(page).getByRole('group', { name: /Korin · L/i });
    await expect(korinRows).toHaveCount(2);
    const names = await korinRows.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')),
    );
    expect(new Set(names).size).toBe(2);
  });

  test('leave alone excludes hero from scope messaging', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);

    await scopePanel(page).getByRole('button', { name: /^Leave alone$/i }).first().click();
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByRole('heading', { name: /Per-hero DPS/i })).toBeVisible();
  });

  test('all leave alone blocks optimize', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);

    let unpicked = scopePanel(page).getByRole('button', { name: /^Leave alone$/i, pressed: false });
    while ((await unpicked.count()) > 0) {
      await unpicked.first().click();
      unpicked = scopePanel(page).getByRole('button', { name: /^Leave alone$/i, pressed: false });
    }
    await expect(page.getByRole('heading', { name: /Nothing in scope/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run the roster gear search/i })).toHaveCount(0);
  });

  test('scope change marks plan stale after a run', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await scopePanel(page).getByRole('button', { name: /^Donate$/i }).first().click();
    await expect(page.getByText(/Inputs changed since this plan/i)).toBeVisible();
  });
});
