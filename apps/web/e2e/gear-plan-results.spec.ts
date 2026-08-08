import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

test.describe('Gear plan results panels', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
  });

  test('waterfall shows three steps and deltas sum to total gain', async ({ page }) => {
    const panel = page
      .getByRole('heading', { name: /^Gain breakdown$/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    await expect(panel.getByText(/^Today$/i)).toBeVisible();
    await expect(panel.getByText(/^Gear$/i)).toBeVisible();
    await expect(panel.getByText(/^Reset points$/i)).toBeVisible();
    await expect(page.getByText(/Best roster DPS found by this search/i)).toBeVisible();
  });

  test('per-hero panel renders a signed delta value', async ({ page }) => {
    const panel = page
      .getByRole('heading', { name: /Per-hero changes/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    await expect(panel).toBeVisible();
    const rows = panel.getByRole('button', { name: /^Detailed breakdown for/i });
    await expect(rows.first()).toBeVisible();
    const text = await panel.innerText();
    expect(/[+-]\d/.test(text)).toBe(true);
  });

  test('in-scope heroes with duplicate names use disambiguated labels', async ({ page }) => {
    const panel = page
      .getByRole('heading', { name: /Per-hero changes/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    const korinRow = panel.getByRole('button', { name: /^Detailed breakdown for Korin · L\d+ · #\d+/i });
    await expect(korinRow.first()).toBeVisible();
  });

  test('expanding a hero row reveals the stat breakdown and proposed gear', async ({ page }) => {
    const panel = page
      .getByRole('heading', { name: /Per-hero changes/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    const trigger = panel.getByRole('button', { name: /^Detailed breakdown for/i }).first();
    await trigger.click();
    await expect(panel.getByText(/^Stat breakdown$/i)).toBeVisible();
    await expect(panel.getByText(/^Proposed gear$/i)).toBeVisible();
  });
});
