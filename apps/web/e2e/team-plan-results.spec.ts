import { test, expect } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoTeamPlan,
  waitForOptimizeDone,
} from './fixtures/team-plan-e2e';

test.describe('Team plan results panels', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
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
  });

  test('waterfall shows total gain above the three steps', async ({ page }) => {
    const panel = page
      .getByRole('heading', { name: /^Gain breakdown$/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    await expect(panel.getByText(/^Total gain$/i)).toBeVisible();
    await expect(panel.getByText(/^Forge /i)).toHaveCount(0);
    await expect(panel.getByText(/^Moves /i)).toHaveCount(0);
  });

  test('point resets panel is gone from results', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^Point resets$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Send to alt loadout/i })).toHaveCount(0);
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
    const perrinRow = panel.getByRole('button', { name: /^Detailed breakdown for Perrin · Lv ?\d+ · #\d+/i });
    await expect(perrinRow.first()).toBeVisible();
  });

  test('first hero row starts expanded so the breakdown is discoverable', async ({ page }) => {
    const panel = page
      .getByRole('heading', { name: /Per-hero changes/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    const trigger = panel.getByRole('button', { name: /^Detailed breakdown for/i }).first();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(panel.getByText(/^Stat breakdown$/i)).toBeVisible();
    await expect(panel.getByText(/^Proposed items$/i)).toBeVisible();
  });

  test('the rows left open survive leaving the page and coming back', async ({ page }) => {
    const panel = page
      .getByRole('heading', { name: /Per-hero changes/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    const rows = panel.getByRole('button', { name: /^Detailed breakdown for/i });
    await rows.first().click();
    await rows.nth(1).click();
    await expect(rows.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(rows.nth(1)).toHaveAttribute('aria-expanded', 'true');

    await page.getByRole('link', { name: /^Farm$/i }).click();
    await expect(page.getByRole('region', { name: /Optimizer/i })).toHaveCount(0);
    await page.getByRole('link', { name: /^Optimizer$/i }).click();
    await expect(page.getByRole('region', { name: /Optimizer/i })).toBeVisible();

    const rowsAgain = page
      .getByRole('heading', { name: /Per-hero changes/i, level: 2 })
      .locator('xpath=ancestor::section[1]')
      .getByRole('button', { name: /^Detailed breakdown for/i });
    await expect(rowsAgain.first()).toHaveAttribute('aria-expanded', 'false');
    await expect(rowsAgain.nth(1)).toHaveAttribute('aria-expanded', 'true');
  });

  test('collapsing then expanding a hero row still reveals the breakdown', async ({ page }) => {
    const panel = page
      .getByRole('heading', { name: /Per-hero changes/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    const trigger = panel.getByRole('button', { name: /^Detailed breakdown for/i }).first();
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.click();
    await expect(panel.getByText(/^Stat breakdown$/i)).toBeVisible();
    await expect(panel.getByText(/^Proposed items$/i)).toBeVisible();
  });
});
