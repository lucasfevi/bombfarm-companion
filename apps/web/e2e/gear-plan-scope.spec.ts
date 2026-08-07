import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  scopePanel,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

test.describe('Gear plan hero scope', () => {
  test('two Korin rows are distinguishable by accessible name', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);

    const korinSelects = scopePanel(page).getByRole('combobox', { name: /Korin · L/i });
    await expect(korinSelects).toHaveCount(2);
    const names = await korinSelects.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')),
    );
    expect(new Set(names).size).toBe(2);
  });

  test('leave alone excludes hero from scope messaging', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);

    await scopePanel(page).getByRole('combobox').first().selectOption('leaveAlone');
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByRole('heading', { name: /Per-hero DPS/i })).toBeVisible();
  });

  test('all leave alone blocks optimize', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);

    const selects = scopePanel(page).getByRole('combobox');
    const count = await selects.count();
    for (let index = 0; index < count; index += 1) {
      await selects.nth(index).selectOption('leaveAlone');
    }
    await expect(page.getByRole('heading', { name: /Nothing in scope/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run the roster gear search/i })).toHaveCount(0);
  });

  test('scope change marks plan stale after a run', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await scopePanel(page).getByRole('combobox').first().selectOption('donate');
    await expect(page.getByText(/Inputs changed since this plan/i)).toBeVisible();
  });

  test('scope board exposes three explained columns', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await expect(scopePanel(page).getByRole('region', { name: /^Optimize$/i })).toBeVisible();
    await expect(scopePanel(page).getByRole('region', { name: /^Donate$/i })).toBeVisible();
    await expect(scopePanel(page).getByRole('region', { name: /^Leave alone$/i })).toBeVisible();
    await expect(
      scopePanel(page).getByText(/Scored in the plan/i),
    ).toBeVisible();
  });
});
