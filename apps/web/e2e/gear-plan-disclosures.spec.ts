import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  disclosuresPanel,
  gotoGearPlan,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

function saturatedSeed() {
  const base = gearPlanFixtureSeed('en');
  // 2 slots against this fixture's ~2.5-3.2 sumDuty range comfortably forces the
  // saturated regime; 3 sat right at the boundary and could tip under-saturated.
  return { ...base, account: { ...base.account!, slots: 2 } };
}

test.describe('Team plan disclosures', () => {
  test('saturated account shows saturation callout without action button', async ({ page }) => {
    await seedLocalStorage(page, saturatedSeed());
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const panel = disclosuresPanel(page);
    await expect(panel.getByText(/battle load/i)).toBeVisible();
    await expect(panel.getByRole('button')).toHaveCount(0);
  });

  test('aura and planner divergence disclosures render', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const panel = disclosuresPanel(page);
    await expect(panel.getByText(/scoped roster/i)).toBeVisible();
    await expect(panel.getByText(/Account tab.*Team buffs/i)).toBeVisible();
    await expect(panel.getByText(/Baton Pass/i)).toBeVisible();
  });

  test('excluded item counts render', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const panel = disclosuresPanel(page);
    await expect(panel.getByText(/market-blocked/i)).toBeVisible();
    await expect(panel.getByText(/foreign owners/i)).toBeVisible();
  });

  test('loadout drift names heroes when inventory disagrees', async ({ page }) => {
    const seed = gearPlanFixtureSeed('en');
    const hero = seed.heroes[0];
    if (!hero) throw new Error('fixture hero missing');
    hero.loadout = {
      ...hero.loadout,
      arma: { defId: 'fake_arma', rarityIdx: 1, level: 1, upgrade: 0 },
    };
    await seedLocalStorage(page, seed);
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    const panel = disclosuresPanel(page);
    await expect(panel.getByText(/inventory as authoritative/i)).toBeVisible();
    await expect(panel.getByText(new RegExp(hero.name, 'i'))).toBeVisible();
  });
});
