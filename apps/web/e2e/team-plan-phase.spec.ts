import { test, expect, type Locator, type Page } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import { clickOptimize, gotoTeamPlan, waitForOptimizeDone } from './fixtures/team-plan-e2e';

/** The DS `SearchSelect` trigger — a Base UI combobox, like `Select`'s. */
function phaseCombobox(page: Page): Locator {
  return page.getByRole('combobox', { name: /^Which phase this search plans for$/i });
}

async function openPhasePicker(page: Page) {
  await phaseCombobox(page).click();
  await expect(page.getByRole('listbox')).toBeVisible();
}

async function search(page: Page, query: string) {
  await openPhasePicker(page);
  await page.keyboard.type(query);
}

async function pickPhase(page: Page, query: string, optionName: RegExp) {
  await search(page, query);
  await page.getByRole('option', { name: optionName }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

test.describe('Team plan phase picker', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
  });

  test('starts on the phase the save says the account is on', async ({ page }) => {
    await expect(phaseCombobox(page)).toBeVisible();
    await expect(phaseCombobox(page)).toHaveText(/^Easy 1-1 \(#1\)$/);
  });

  test('does not render all 600 phases at once, and says how many it is holding back', async ({
    page,
  }) => {
    await openPhasePicker(page);
    const options = page.getByRole('option');
    await expect(options).toHaveCount(50);
    await expect(page.getByText(/Showing 50 of 601 — keep typing to narrow\./)).toBeVisible();
  });

  test('finds a phase by the difficulty word', async ({ page }) => {
    await search(page, 'Normal');
    await expect(page.getByRole('option', { name: 'Normal 2-1 (#71)' })).toBeVisible();
    await expect(page.getByRole('option', { name: /^Easy/ })).toHaveCount(0);
  });

  test('finds a phase by the full coordinate', async ({ page }) => {
    await search(page, 'Normal 3-4');
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option', { name: 'Normal 3-4 (#94)' })).toBeVisible();
  });

  test('finds a phase by the bare number', async ({ page }) => {
    await search(page, '151');
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option', { name: 'Hard 1-1 (#151)' })).toBeVisible();
  });

  test('None is a real option, not the absence of one', async ({ page }) => {
    await pickPhase(page, 'None', /^None$/);
    await expect(phaseCombobox(page)).toHaveText(/^None$/);
    await expect(page.getByText(/No phase pinned\./)).toBeVisible();
  });

  test('a chosen phase past the account’s furthest says so', async ({ page }) => {
    await pickPhase(page, '151', /^Hard 1-1 \(#151\)$/);
    await expect(page.getByText(/Past the furthest phase your account has reached/)).toBeVisible();
  });

  test('a gold plan reports the phase it was scored at, and that the player picked it', async ({
    page,
  }) => {
    await pickPhase(page, 'Normal 1-1', /^Normal 1-1 \(#51\)$/);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByText(/Normal 1-1 \(#51\) — the phase you picked\./)).toBeVisible();
  });

  test('with None, a gold plan reports the phase it settled on as automatic', async ({ page }) => {
    await pickPhase(page, 'None', /^None$/);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByText(/picked automatically, the best this squad can hold\./)).toBeVisible();
  });

  test('a damage plan on None stays on the account’s own phase and says nothing automatic', async ({
    page,
  }) => {
    await page.getByRole('combobox', { name: /^What this search scores a roster on$/i }).click();
    await page.getByRole('option', { name: /^DPS$/i }).click();
    await pickPhase(page, 'None', /^None$/);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByText(/Easy 1-1 \(#1\) — the phase you picked\./)).toHaveCount(0);
    await expect(page.getByText(/picked automatically/)).toHaveCount(0);
  });
});
