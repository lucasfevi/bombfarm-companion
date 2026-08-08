import { test, expect } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { importedRoster, seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoTeamPlan,
  setE2eForceError,
  setE2eMaxEvaluations,
  snapshotHeroesJson,
  waitForOptimizeDone,
} from './fixtures/team-plan-e2e';

test.describe('Team plan page states', () => {
  test('no inventory shows empty state', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await gotoTeamPlan(page);
    await expect(page.getByRole('heading', { name: /No item inventory yet/i })).toBeVisible();
  });

  test('blocked heroes without birth are named', async ({ page }) => {
    const seed = teamPlanFixtureSeed('en');
    const hero = seed.heroes[0];
    if (!hero) throw new Error('fixture hero missing');
    delete (hero as { birth?: unknown }).birth;
    await seedLocalStorage(page, seed);
    await gotoTeamPlan(page);
    await clickOptimize(page);
    const blocked = page.getByRole('heading', { name: /Cannot run — missing birth stats/i }).locator(
      'xpath=ancestor::div[1]',
    );
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText(hero.name);
  });

  test('optimize without confirm leaves heroes storage unchanged', async ({ page }) => {
    // Runs the real solver at its default (uncapped) evaluation budget on the 11-hero
    // fixture — the only test in this file that does. waitForOptimizeDone's 120s expect
    // timeout needs a matching test-level timeout, or Playwright's 30s default kills the
    // test first (same pattern as perf.spec.ts's long-running capture).
    test.setTimeout(150_000);
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    const before = await snapshotHeroesJson(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await page.reload();
    const after = await snapshotHeroesJson(page);
    expect(after).toBe(before);
  });

  test('runner error shows retry control', async ({ page }) => {
    await setE2eForceError(page, true);
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await expect(page.getByRole('heading', { name: /Search failed/i })).toBeVisible({ timeout: 120_000 });
    await expect(page.getByRole('button', { name: /Try again/i })).toBeVisible();
  });

  test('optimizing modal can cancel the run', async ({ page }) => {
    await setE2eMaxEvaluations(page, 50_000);
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await expect(page.getByRole('dialog', { name: /Optimizing/i })).toBeVisible();
    await expect(page.getByText(/^Elapsed /i)).toBeVisible();
    await page.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(page.getByRole('dialog', { name: /Optimizing/i })).toBeHidden();
    await expect(
      page.getByRole('button', { name: /Build a team plan of gear moves and point resets/i }),
    ).toBeEnabled();
  });
});
