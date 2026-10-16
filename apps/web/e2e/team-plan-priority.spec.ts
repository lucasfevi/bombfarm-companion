import { test, expect } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import { clickOptimize, gotoTeamPlan, scopePanel, waitForOptimizeDone } from './fixtures/team-plan-e2e';

test.describe('Team plan priority order', () => {
  test('ranks the Optimize cards, reorders them, and plans one hero at a time', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);

    const optimizeCards = scopePanel(page).locator('[data-scope-column="optimize"] article');
    await expect(optimizeCards.locator('[data-priority-rank]')).toHaveCount(0);

    await scopePanel(page).getByRole('switch', { name: /one at a time/i }).click();
    const cardCount = await optimizeCards.count();
    expect(cardCount).toBeGreaterThan(1);
    await expect(optimizeCards.locator('[data-priority-rank]')).toHaveCount(cardCount);
    await expect(optimizeCards.first().locator('[data-priority-rank]')).toHaveText('1');

    const second = await optimizeCards.nth(1).getAttribute('aria-label');
    await optimizeCards.nth(1).getByRole('button', { name: /up the priority order/i }).click();
    await expect(optimizeCards.first()).toHaveAttribute('aria-label', second ?? '');

    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByText(/geared one hero at a time, in priority order/i)).toBeVisible();

    await page.getByRole('combobox', { name: /Sort heroes by/i }).click();
    await expect(page.getByRole('option', { name: /^Priority$/ })).toBeVisible();
  });
});
