import { test, expect, type Locator, type Page } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import { gotoTeamPlan, openFieldHelp } from './fixtures/team-plan-e2e';

const ALLOWED_HELP = /^What to change: /i;

/** DS Select is a Base UI combobox — not a native `<select>`. */
function allowedChangesCombobox(page: Page): Locator {
  return page.getByRole('combobox', { name: /^Which kinds of change this plan may propose$/i });
}

function forgeFloorField(page: Page): Locator {
  return page.getByTestId('team-plan-forge-floor-field');
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
    await expect(await openFieldHelp(page, ALLOWED_HELP)).toContainText(
      /may move gear, order forge work, and re-spend stat points/i,
    );
  });

  test('each setting restates what the plan may propose', async ({ page }) => {
    await pickAllowedChanges(page, /^Points only$/);
    await expect(await openFieldHelp(page, ALLOWED_HELP)).toContainText(/No gear moves and no forge work/i);

    await pickAllowedChanges(page, /^Gear only$/);
    await expect(await openFieldHelp(page, ALLOWED_HELP)).toContainText(/No point resets/i);
  });

  /**
   * The visible label never changes, so a reader who cannot see which mode is selected has only
   * the accessible name to tell them what the button will do.
   */
  test('the Optimize button accessible name follows the setting', async ({ page }) => {
    // The setup labels' own tooltips name gear moves and point resets too, so the check is on
    // the Optimize button's name, not on whether any button carries the words.
    const optimize = page.getByRole('button', { name: /^Build a team plan of / });

    await expect(optimize).toHaveAccessibleName(/^Build a team plan of gear moves and point resets$/);

    await pickAllowedChanges(page, /^Points only$/);
    await expect(optimize).toHaveAccessibleName(/^Build a team plan of point resets$/);
    await expect(optimize).not.toHaveAccessibleName(/gear moves/i);

    await pickAllowedChanges(page, /^Gear only$/);
    await expect(optimize).toHaveAccessibleName(/^Build a team plan of gear moves$/);
    await expect(optimize).not.toHaveAccessibleName(/point resets/i);
  });

  /** A forge floor a points-only plan is scored without is a control that does nothing. */
  test('points only takes the forge floor off the setup bar', async ({ page }) => {
    await expect(forgeFloorField(page)).toBeVisible();
    await pickAllowedChanges(page, /^Points only$/);
    await expect(forgeFloorField(page)).toHaveCount(0);
    await pickAllowedChanges(page, /^Gear and points$/);
    await expect(forgeFloorField(page)).toBeVisible();
  });
});
