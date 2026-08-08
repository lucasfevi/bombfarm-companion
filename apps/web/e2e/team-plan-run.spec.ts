import { test, expect } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoTeamPlan,
  setE2eMaxEvaluations,
  waitForOptimizeDone,
} from './fixtures/team-plan-e2e';

test.describe('Team plan optimize run', () => {
  test('optimize shows a plain-language search summary', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const summary = page
      .getByRole('heading', { name: /^Search summary$/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    await expect(summary.getByText(/^Field status:/i)).toBeVisible();
    await expect(summary.getByText(/Fits the field|Field is full/i)).toBeVisible();
    await expect(summary.getByText(/^Battle load:/i)).toBeVisible();
    await expect(summary.getByText(/Took [\d.]+s/i)).toBeVisible();
    await expect(summary.getByText(/search passes/i)).toBeVisible();
    await expect(summary.getByText(/builds checked/i)).toBeVisible();
    await expect(summary.getByText(/started from today's gear|started with/i)).toBeVisible();
    await expect(summary.getByRole('button', { name: /Search details/i })).toHaveCount(0);
  });

  test('second click while running does not duplicate summaries', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    const button = page.getByRole('button', {
      name: /Build a team plan of gear moves and point resets/i,
    });
    await button.click();
    await button.click({ force: true });
    await waitForOptimizeDone(page);
    await expect(page.getByRole('heading', { name: /^Search summary$/i, level: 2 })).toHaveCount(1);
  });

  test('budget exhausted shows truncation notice', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await setE2eMaxEvaluations(page, 5);
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByText(/Search stopped early to save time/i)).toBeVisible();
  });
});
