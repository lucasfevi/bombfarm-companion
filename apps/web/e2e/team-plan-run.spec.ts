import { test, expect } from '@playwright/test';
import { teamPlanFixtureSeed, teamPlanRichSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoTeamPlan,
  openSearchSummary,
  setE2eMaxEvaluations,
  waitForOptimizeDone,
} from './fixtures/team-plan-e2e';

test.describe('Team plan optimize run', () => {
  test('the gain breakdown leads with the phase and the battle load; the summary is folded', async ({
    page,
  }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const breakdown = page
      .getByRole('heading', { name: /^Gain breakdown$/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    const phaseCard = breakdown.getByTestId('team-plan-phase-card');
    await expect(phaseCard).toContainText(/^Phase/);
    await expect(phaseCard).toContainText(/\(#\d+\)/);
    const battleLoad = breakdown.getByTestId('team-plan-battle-load-card');
    await expect(battleLoad).toContainText(/^Battle load/);
    await expect(battleLoad).toContainText(/[\d.]+ of \d+ slots/);
    await expect(battleLoad).toContainText(/Fits the field|Field is full/);

    const summary = page.getByTestId('team-plan-run-summary');
    await expect(summary.getByRole('heading', { name: /^Search summary$/i, level: 2 })).toBeVisible();
    await expect(summary.getByText(/search passes/i)).toHaveCount(0);
    await expect(breakdown.locator('xpath=following-sibling::section[1]')).toHaveAttribute(
      'data-testid',
      'team-plan-run-summary',
    );
  });

  test('opening the search summary shows how the search went', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const summary = await openSearchSummary(page);
    await expect(summary.getByText(/Took [\d.]+s/i)).toBeVisible();
    await expect(summary.getByText(/search passes/i)).toBeVisible();
    await expect(summary.getByText(/builds checked/i)).toBeVisible();
    await expect(
      summary.getByText(/started from today's items|started from an alternate setup/i),
    ).toBeVisible();
  });

  test('second click while running does not duplicate summaries', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    const button = page.getByRole('button', {
      name: /^Build a team plan of /i,
    });
    await button.click();
    await button.click({ force: true });
    await waitForOptimizeDone(page);
    await expect(page.getByRole('heading', { name: /^Search summary$/i, level: 2 })).toHaveCount(1);
  });

  // The RICH seed: truncation needs a search big enough for a cap of 5 to actually cut it short.
  // The structural seed's three gearless heroes finish inside that budget, so the notice never
  // appeared and this case was disabled (issue #206).
  test('budget exhausted shows truncation notice', async ({ page }) => {
    await seedLocalStorage(page, teamPlanRichSeed('en'));
    await setE2eMaxEvaluations(page, 5);
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByText(/Search stopped early to save time/i)).toBeVisible();
  });
});
