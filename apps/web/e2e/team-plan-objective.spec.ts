import { test, expect, type Locator, type Page } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoTeamPlan,
  openFieldHelp,
  waitForOptimizeDone,
} from './fixtures/team-plan-e2e';

/** The setup panel's intro is a tooltip on its title. */
const SETUP_HELP = /^Search setup: /i;

/** DS Select is a Base UI combobox — not a native `<select>`. */
function objectiveCombobox(page: Page): Locator {
  return page.getByRole('combobox', { name: /^What this search scores a roster on$/i });
}

async function pickObjective(page: Page, optionName: RegExp) {
  await objectiveCombobox(page).click();
  await page.getByRole('option', { name: optionName }).click();
}

/** The Total gain figure's own unit word is what tells gold and damage plans apart now — the
 *  results section carries no separate objective-named caption any more. */
function totalGain(page: Page): Locator {
  return page.getByTestId('team-plan-total-gain');
}
const GOLD_UNIT = /gold\/h/i;
const DAMAGE_UNIT = /\bdps\b/i;

test.describe('Team plan objective', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
  });

  test('the control is on the setup panel and starts on gold per hour', async ({ page }) => {
    await expect(objectiveCombobox(page)).toBeVisible();
    await expect(objectiveCombobox(page)).toHaveText(/^Gold \/ hr$/i);
    await expect(await openFieldHelp(page, SETUP_HELP)).toContainText(/scored for the gold per hour/i);
  });

  test('switching to DPS restates what the search will score', async ({ page }) => {
    await pickObjective(page, /^DPS$/i);
    await expect(objectiveCombobox(page)).toHaveText(/^DPS$/i);
    await expect(await openFieldHelp(page, SETUP_HELP)).toContainText(/scored for combined roster DPS/i);
  });

  test('a Gold plan reports gold per hour and never roster DPS', async ({ page }) => {
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(totalGain(page)).toContainText(GOLD_UNIT);
    await expect(totalGain(page)).not.toContainText(DAMAGE_UNIT);
  });

  test('a Damage plan reports roster DPS', async ({ page }) => {
    await pickObjective(page, /^DPS$/i);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(totalGain(page)).toContainText(DAMAGE_UNIT);
    await expect(totalGain(page)).not.toContainText(GOLD_UNIT);
  });

  test('switching the objective removes the plan already on screen', async ({ page }) => {
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    const results = page.getByRole('region', { name: /Team plan results/i });
    await expect(results).toBeVisible();

    await pickObjective(page, /^DPS$/i);

    // Not a stale banner over gold numbers under a damage heading — the section is gone.
    await expect(results).toHaveCount(0);
    await expect(totalGain(page)).toHaveCount(0);
    await expect(page.getByText(/Your account changed since this plan was built/i)).toHaveCount(0);
  });
});

/**
 * The furthest phase bounds a SWEEP. Naming a phase removes the sweep, so this record's own phase
 * — which the picker adopts by default — is enough for gold on its own, and the warning is
 * reachable only once the picker is put back on None.
 */
test.describe('Team plan objective — a record with no furthest phase', () => {
  const NEEDS_PHASE = /Letting the search pick its own phase needs the furthest phase/i;

  test.beforeEach(async ({ page }) => {
    const seed = teamPlanFixtureSeed('en');
    await seedLocalStorage(page, {
      ...seed,
      account: { ...seed.account!, maxPhase: null },
    });
    await gotoTeamPlan(page);
  });

  async function pickNoPhase(page: Page) {
    await page.getByRole('combobox', { name: /^Which phase this search plans for$/i }).click();
    await page.getByRole('option', { name: /^None$/ }).click();
  }

  test('says what an unpinned gold search needs and refuses to run, rather than failing mid-search', async ({
    page,
  }) => {
    await expect(objectiveCombobox(page)).toHaveText(/^Gold \/ hr$/i);
    await pickNoPhase(page);
    await expect(page.getByText(NEEDS_PHASE)).toBeVisible();
    await expect(
      page.getByRole('button', { name: /^Build a team plan of /i }),
    ).toBeDisabled();
    await expect(page.getByRole('heading', { name: /^Search failed$/i })).toHaveCount(0);
  });

  test('naming a phase lifts that block — the record needs no furthest phase to price one', async ({
    page,
  }) => {
    await pickNoPhase(page);
    await expect(page.getByText(NEEDS_PHASE)).toBeVisible();

    await page.getByRole('combobox', { name: /^Which phase this search plans for$/i }).click();
    await expect(page.getByPlaceholder('Hard, Normal 2-1, or 151')).toBeFocused();
    await page.keyboard.type('Normal 1-1');
    await page.getByRole('option', { name: 'Normal 1-1 (#51)' }).click();

    await expect(page.getByText(NEEDS_PHASE)).toHaveCount(0);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(totalGain(page)).toContainText(GOLD_UNIT);
  });

  test('DPS still runs on the same record', async ({ page }) => {
    await pickObjective(page, /^DPS$/i);
    await pickNoPhase(page);
    await expect(page.getByText(NEEDS_PHASE)).toHaveCount(0);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(totalGain(page)).toContainText(DAMAGE_UNIT);
  });
});
