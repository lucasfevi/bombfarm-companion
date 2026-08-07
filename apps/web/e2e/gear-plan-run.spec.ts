import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  setE2eMaxEvaluations,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

test.describe('Gear plan optimize run', () => {
  test('optimize shows run summary with regime', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    await expect(page.getByText(/^Regime:/i)).toBeVisible();
    await expect(page.getByText(/Under-saturated|Saturated/i)).toBeVisible();
    await expect(page.getByText(/Σ duty vs slots/i)).toBeVisible();
    await expect(page.getByText(/Rounds:/i)).toBeVisible();
    await expect(page.getByText(/Evaluations:/i)).toBeVisible();
    await expect(page.getByText(/Elapsed:/i)).toBeVisible();
  });

  test('second click while running does not duplicate summaries', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    const button = page.getByRole('button', { name: /Run the roster gear search/i });
    await button.click();
    await button.click({ force: true });
    await waitForOptimizeDone(page);
    await expect(page.getByText(/^Regime:/i)).toHaveCount(1);
  });

  test('budget exhausted shows truncation notice', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await setE2eMaxEvaluations(page, 5);
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(
      page.getByText(/Search stopped at the evaluation cap/i),
    ).toBeVisible();
  });
});
