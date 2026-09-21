import { test, expect } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import { clickOptimize, gotoTeamPlan, openFieldHelp, waitForOptimizeDone } from './fixtures/team-plan-e2e';

test.describe('Team plan field-crowding opt-out', () => {
  test('the control explains which question the next run answers', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);

    const toggle = page.getByRole('switch', {
      name: /Score as if the field always had room/i,
    });
    await expect(toggle).toBeVisible();
    const help = /^Keep every hero geared: /i;
    await expect(await openFieldHelp(page, help)).toContainText(/which is why it can ask you to remove gear/i);

    await toggle.click();

    const after = await openFieldHelp(page, help);
    await expect(after).toContainText(/Scoring as if the field always had room/i);
    await expect(after).not.toContainText(/which is why it can ask you to remove gear/i);
  });

  test('toggling it drops a finished plan, because the figures answer a different question', async ({
    page,
  }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(page.getByRole('heading', { name: /^Gain breakdown$/i, level: 2 })).toBeVisible();

    await page.getByRole('switch', { name: /Score as if the field always had room/i }).click();

    await expect(page.getByRole('heading', { name: /^Gain breakdown$/i, level: 2 })).toHaveCount(0);
  });
});
