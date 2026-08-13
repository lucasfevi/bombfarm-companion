import { test, expect } from '@playwright/test';
import { teamPlanFixtureSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  disclosuresPanel,
  gotoTeamPlan,
  waitForOptimizeDone,
} from './fixtures/team-plan-e2e';

function saturatedSeed() {
  const base = teamPlanFixtureSeed('en');
  // MP5 F1 (AD-069, extended by orchestrator ruling): re-tuned for the post-patch 5-hero
  // export. `slots` alone can no longer force saturation — this roster's own sumDuty tops out
  // at ~0.99 at the export's real house (Casa I L7), strictly below the minimum slots value
  // (evaluateRoster clamps slots to >= 1), so no slots override could reach the saturated
  // regime. `duty = fieldSeconds / (fieldSeconds + restSeconds)` (model/combat.ts) is driven by
  // house rest time, not slots or phase/mitigation — measured, phase and mitigationPct have
  // zero effect on sumDuty. Maxing the house (Casa V, level 20 — the shortest rest in
  // `HOUSES`) measures sumDuty ~2.12, comfortably above `slots: 1` (a >2x margin, not a
  // boundary case). Both overrides are local to this scenario, the same category as the
  // pre-existing `slots` override — team-plan-seed.ts's own defaults are untouched.
  return {
    ...base,
    account: {
      ...base.account!,
      slots: 1,
      context: { ...base.account!.context, houseIdx: 4, houseLevel: 20 },
    },
  };
}

test.describe('Team plan disclosures', () => {
  test('saturated account shows saturation callout without action button', async ({ page }) => {
    await seedLocalStorage(page, saturatedSeed());
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const panel = disclosuresPanel(page);
    await expect(panel.getByText(/battle load/i)).toBeVisible();
    await expect(panel.getByRole('button')).toHaveCount(0);
  });

  test('aura and planner divergence disclosures render', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const panel = disclosuresPanel(page);
    await expect(panel.getByText(/scoped roster/i)).toBeVisible();
    await expect(panel.getByText(/Account tab.*Team buffs/i)).toBeVisible();
    await expect(panel.getByText(/Baton Pass/i)).toBeVisible();
  });

  test('excluded item counts render', async ({ page }) => {
    await seedLocalStorage(page, teamPlanFixtureSeed('en'));
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const panel = disclosuresPanel(page);
    await expect(panel.getByText(/market-blocked/i)).toBeVisible();
    await expect(panel.getByText(/foreign owners/i)).toBeVisible();
  });

  test('loadout drift names heroes when inventory disagrees', async ({ page }) => {
    const seed = teamPlanFixtureSeed('en');
    const hero = seed.heroes[0];
    if (!hero) throw new Error('fixture hero missing');
    hero.loadout = {
      ...hero.loadout,
      arma: { defId: 'fake_arma', rarityIdx: 1, level: 1, upgrade: 0 },
    };
    await seedLocalStorage(page, seed);
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    const panel = disclosuresPanel(page);
    await expect(panel.getByText(/inventory as authoritative/i)).toBeVisible();
    await expect(panel.getByText(new RegExp(hero.name, 'i'))).toBeVisible();
  });
});
