import { test, expect, type Locator, type Page } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  scopePanel,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

async function gotoGearPlanMobile(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLocalStorage(page, gearPlanFixtureSeed('en'));
  await gotoGearPlan(page);
}

/** DS Select is Base UI combobox — not a native `<select>`. */
async function pickScope(combobox: Locator, page: Page, optionName: RegExp) {
  await combobox.click();
  await page.getByRole('option', { name: optionName }).click();
}

test.describe('Gear plan hero scope', () => {
  test('two Korin rows are distinguishable by accessible name', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);

    const korinCards = scopePanel(page).locator('article[aria-label*="Korin · L"]');
    await expect(korinCards).toHaveCount(2);
    const names = await korinCards.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')),
    );
    expect(new Set(names).size).toBe(2);
  });

  test('desktop hides the per-card scope select', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await expect(scopePanel(page).getByRole('combobox').first()).toBeHidden();
  });

  test('leave alone excludes hero from scope messaging', async ({ page }) => {
    await gotoGearPlanMobile(page);

    await pickScope(scopePanel(page).getByRole('combobox').first(), page, /^Leave alone$/i);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByRole('heading', { name: /Per-hero DPS/i })).toBeVisible();
  });

  test('all leave alone blocks optimize', async ({ page }) => {
    await gotoGearPlanMobile(page);

    for (let safety = 0; safety < 40; safety += 1) {
      const openSelect = scopePanel(page)
        .locator(
          '[data-scope-column="optimize"] [data-select], [data-scope-column="donate"] [data-select]',
        )
        .first();
      if ((await openSelect.count()) === 0) break;
      await pickScope(openSelect, page, /^Leave alone$/i);
    }
    await expect(page.getByRole('heading', { name: /Nothing in scope/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Run the roster gear search/i })).toHaveCount(0);
  });

  test('scope change marks plan stale after a run', async ({ page }) => {
    await gotoGearPlanMobile(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await pickScope(scopePanel(page).getByRole('combobox').first(), page, /^Donate$/i);
    await expect(page.getByText(/Inputs changed since this plan/i)).toBeVisible();
  });

  test('scope board exposes three explained columns', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await expect(scopePanel(page).getByRole('region', { name: /^Optimize$/i })).toBeVisible();
    await expect(scopePanel(page).getByRole('region', { name: /^Donate$/i })).toBeVisible();
    await expect(scopePanel(page).getByRole('region', { name: /^Leave alone$/i })).toBeVisible();
    await expect(scopePanel(page).getByText(/Scored in the plan/i)).toBeVisible();
  });

  test('mobile keeps the scope select on each card', async ({ page }) => {
    await gotoGearPlanMobile(page);
    const firstSelect = scopePanel(page).getByRole('combobox').first();
    await expect(firstSelect).toBeVisible();
    await pickScope(firstSelect, page, /^Donate$/i);
    await expect(
      scopePanel(page).getByRole('region', { name: /^Donate$/i }).locator('article'),
    ).not.toHaveCount(0);
  });
});
