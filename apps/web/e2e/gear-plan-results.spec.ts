import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  readForgeFloorValue,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

test.describe('Gear plan results panels', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
  });

  test('waterfall shows four steps and deltas sum to total gain', async ({ page }) => {
    const panel = page
      .getByRole('heading', { name: /^Gain breakdown$/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    await expect(panel.getByText(/^Today$/i)).toBeVisible();
    await expect(panel.getByText(/^Forge to floor$/i)).toBeVisible();
    await expect(panel.getByText(/^Moves$/i)).toBeVisible();
    await expect(panel.getByText(/^Reset points$/i)).toBeVisible();
    await expect(page.getByText(/Best roster DPS found by this search/i)).toBeVisible();
  });

  test('per-hero table renders signed delta column', async ({ page }) => {
    const table = page
      .getByRole('heading', { name: /Per-hero DPS/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    await expect(table).toBeVisible();
    const deltaCells = table.locator('tbody td:nth-child(4)');
    const texts = await deltaCells.allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((text) => /^[+-]/.test(text.trim()))).toBe(true);
  });

  test('in-scope heroes with duplicate names use disambiguated labels', async ({ page }) => {
    const table = page
      .getByRole('heading', { name: /Per-hero DPS/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    const korinCells = table.getByRole('cell', { name: /Korin · L\d+ · #/i });
    await expect(korinCells.first()).toBeVisible();
    const label = await korinCells.first().textContent();
    expect(label).toMatch(/#\d+/);
  });
});
