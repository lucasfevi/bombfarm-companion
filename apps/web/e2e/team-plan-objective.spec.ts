import { test, expect, type Locator, type Page } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import { clickOptimize, gotoTeamPlan, waitForOptimizeDone } from './fixtures/team-plan-e2e';

/** DS Select is a Base UI combobox — not a native `<select>`. */
function objectiveCombobox(page: Page): Locator {
  return page.getByRole('combobox', { name: /^What this search scores a roster on$/i });
}

async function pickObjective(page: Page, optionName: RegExp) {
  await objectiveCombobox(page).click();
  await page.getByRole('option', { name: optionName }).click();
}

const GOLD_HEADER = /Best gold per hour found by this search/i;
const DAMAGE_HEADER = /Best roster DPS found by this search/i;

test.describe('Team plan objective', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
  });

  test('the control is on the setup panel and starts on Gold', async ({ page }) => {
    await expect(objectiveCombobox(page)).toBeVisible();
    await expect(objectiveCombobox(page)).toHaveText(/^Gold$/i);
    await expect(page.getByText(/scored for the gold per hour/i)).toBeVisible();
  });

  test('switching to Damage restates what the search will score', async ({ page }) => {
    await pickObjective(page, /^Damage$/i);
    await expect(objectiveCombobox(page)).toHaveText(/^Damage$/i);
    await expect(page.getByText(/scored for combined roster DPS/i)).toBeVisible();
  });

  test('a Gold plan reports gold per hour and never roster DPS', async ({ page }) => {
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByText(GOLD_HEADER)).toBeVisible();
    await expect(page.getByText(DAMAGE_HEADER)).toHaveCount(0);
  });

  test('a Damage plan reports roster DPS', async ({ page }) => {
    await pickObjective(page, /^Damage$/i);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByText(DAMAGE_HEADER)).toBeVisible();
    await expect(page.getByText(GOLD_HEADER)).toHaveCount(0);
  });

  test('switching the objective removes the plan already on screen', async ({ page }) => {
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    const results = page.getByRole('region', { name: /Team plan results/i });
    await expect(results).toBeVisible();

    await pickObjective(page, /^Damage$/i);

    // Not a stale banner over gold numbers under a damage heading — the section is gone.
    await expect(results).toHaveCount(0);
    await expect(page.getByText(GOLD_HEADER)).toHaveCount(0);
    await expect(page.getByText(/Inputs changed since this plan was computed/i)).toHaveCount(0);
  });
});

test.describe('Team plan objective — a record with no furthest phase', () => {
  test.beforeEach(async ({ page }) => {
    const seed = teamPlanFixtureSeed('en');
    await seedLocalStorage(page, {
      ...seed,
      account: { ...seed.account!, maxPhase: null },
    });
    await gotoTeamPlan(page);
  });

  test('says what gold scoring needs and refuses to run, rather than failing mid-search', async ({
    page,
  }) => {
    await expect(objectiveCombobox(page)).toHaveText(/^Gold$/i);
    await expect(
      page.getByText(/Scoring for gold needs the furthest phase your account has reached/i),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Build a team plan of gear moves and point resets/i }),
    ).toBeDisabled();
    await expect(page.getByRole('heading', { name: /^Search failed$/i })).toHaveCount(0);
  });

  test('Damage still runs on the same record', async ({ page }) => {
    await pickObjective(page, /^Damage$/i);
    await expect(
      page.getByText(/Scoring for gold needs the furthest phase your account has reached/i),
    ).toHaveCount(0);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByText(DAMAGE_HEADER)).toBeVisible();
  });
});
