import { test, expect, type Locator, type Page } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoTeamPlan,
  scopePanel,
  waitForOptimizeDone,
} from './fixtures/team-plan-e2e';

async function gotoTeamPlanMobile(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedLocalStorage(page, teamPlanFixtureSeed('en'));
  await gotoTeamPlan(page);
}

/** DS Select is Base UI combobox — not a native `<select>`. */
async function pickScope(combobox: Locator, page: Page, optionName: RegExp) {
  await combobox.click();
  await page.getByRole('option', { name: optionName }).click();
}

test.describe('Team plan hero scope', () => {
  test('two Korin rows are distinguishable by accessible name', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);

    const korinCards = scopePanel(page).locator('article[aria-label*="Korin · Lv"]');
    await expect(korinCards).toHaveCount(2);
    const names = await korinCards.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')),
    );
    expect(new Set(names).size).toBe(2);
  });

  test('desktop hides the per-card scope select', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await expect(scopePanel(page).getByRole('combobox').first()).toBeHidden();
  });

  test('leave alone excludes hero from scope messaging', async ({ page }) => {
    await gotoTeamPlanMobile(page);

    await pickScope(scopePanel(page).getByRole('combobox').first(), page, /^Leave alone$/i);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByRole('heading', { name: /Per-hero changes/i })).toBeVisible();
  });

  test('all leave alone blocks optimize', async ({ page }) => {
    await gotoTeamPlanMobile(page);

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
    await expect(
      page.getByRole('button', { name: /Build a team plan of gear moves and point resets/i }),
    ).toBeDisabled();
  });

  test('scope change clears the plan outright (reshapes the search, not just its numbers)', async ({
    page,
  }) => {
    await gotoTeamPlanMobile(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByRole('heading', { name: /^Plan results$/i, level: 2 })).toBeVisible();
    await pickScope(scopePanel(page).getByRole('combobox').first(), page, /^Donate$/i);
    await expect(page.getByRole('heading', { name: /^Plan results$/i, level: 2 })).toHaveCount(0);
  });

  test('scope board exposes three explained columns', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await expect(scopePanel(page).getByRole('region', { name: /^Optimize$/i })).toBeVisible();
    await expect(scopePanel(page).getByRole('region', { name: /^Donate$/i })).toBeVisible();
    await expect(scopePanel(page).getByRole('region', { name: /^Leave alone$/i })).toBeVisible();
    await expect(scopePanel(page).getByText(/Scored in the plan/i)).toBeVisible();
  });

  test('mobile keeps the scope select on each card', async ({ page }) => {
    await gotoTeamPlanMobile(page);
    const firstSelect = scopePanel(page).getByRole('combobox').first();
    await expect(firstSelect).toBeVisible();
    await pickScope(firstSelect, page, /^Donate$/i);
    await expect(
      scopePanel(page).getByRole('region', { name: /^Donate$/i }).locator('article'),
    ).not.toHaveCount(0);
  });
});
