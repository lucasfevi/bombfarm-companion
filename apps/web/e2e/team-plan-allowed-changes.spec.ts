import { test, expect, type Locator, type Page } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import { clickOptimize, disclosuresPanel, gotoTeamPlan, waitForOptimizeDone } from './fixtures/team-plan-e2e';

/** DS Select is a Base UI combobox — not a native `<select>`. */
function allowedChangesCombobox(page: Page): Locator {
  return page.getByRole('combobox', { name: /^Which kinds of change this plan may propose$/i });
}

function forgeFloorField(page: Page): Locator {
  return page.locator('label').filter({ hasText: /Min forge \(\+\)/i });
}

async function pickAllowedChanges(page: Page, optionName: RegExp) {
  await allowedChangesCombobox(page).click();
  await page.getByRole('option', { name: optionName }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

test.describe('Team plan allowed changes', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
  });

  test('the control is on the setup panel and starts on both', async ({ page }) => {
    await expect(allowedChangesCombobox(page)).toBeVisible();
    await expect(allowedChangesCombobox(page)).toHaveText(/^Gear and points$/);
    await expect(page.getByText(/may move gear, order forge work, and re-spend stat points/i)).toBeVisible();
  });

  test('each setting restates what the plan may propose', async ({ page }) => {
    await pickAllowedChanges(page, /^Points only$/);
    await expect(page.getByText(/No gear moves and no forge work/i)).toBeVisible();

    await pickAllowedChanges(page, /^Gear only$/);
    await expect(page.getByText(/No point resets/i)).toBeVisible();
  });

  /**
   * The visible label never changes, so a reader who cannot see which mode is selected has only
   * the accessible name to tell them what the button will do.
   */
  test('the Optimize button accessible name follows the setting', async ({ page }) => {
    const named = (name: RegExp) => page.getByRole('button', { name });

    await expect(named(/^Build a team plan of gear moves and point resets$/)).toBeVisible();

    await pickAllowedChanges(page, /^Points only$/);
    await expect(named(/^Build a team plan of point resets$/)).toBeVisible();
    await expect(named(/gear moves/i)).toHaveCount(0);

    await pickAllowedChanges(page, /^Gear only$/);
    await expect(named(/^Build a team plan of gear moves$/)).toBeVisible();
    await expect(named(/point resets/i)).toHaveCount(0);
  });

  /** A forge floor a points-only plan is scored without is a control that does nothing. */
  test('points only takes the forge floor off the setup bar', async ({ page }) => {
    await expect(forgeFloorField(page)).toBeVisible();
    await pickAllowedChanges(page, /^Points only$/);
    await expect(forgeFloorField(page)).toHaveCount(0);
    await pickAllowedChanges(page, /^Gear and points$/);
    await expect(forgeFloorField(page)).toBeVisible();
  });

  test('a points-only plan says so, and lists no gear chores', async ({ page }) => {
    await pickAllowedChanges(page, /^Points only$/);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    await expect(disclosuresPanel(page).getByText(/You limited this plan to stat points/i)).toBeVisible();
    // The forge-skipped line claims forging "did not improve" the objective — it was never tried.
    await expect(disclosuresPanel(page).getByText(/Forging to your minimum was left out/i)).toHaveCount(0);
  });

  test('a gear-only plan says so', async ({ page }) => {
    await pickAllowedChanges(page, /^Gear only$/);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    await expect(disclosuresPanel(page).getByText(/You limited this plan to gear/i)).toBeVisible();
  });

  test('an unrestricted plan carries neither restriction note', async ({ page }) => {
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    await expect(disclosuresPanel(page).getByText(/You limited this plan to/i)).toHaveCount(0);
  });
});
