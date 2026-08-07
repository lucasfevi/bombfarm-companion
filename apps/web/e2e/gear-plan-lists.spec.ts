import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  readForgeFloorValue,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

test.describe('Gear plan chore lists', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
  });

  test('forge list is non-empty at floor 10 and empty at floor 0', async ({ page }) => {
    const forgePanel = page
      .getByRole('heading', { name: /^Forge list$/i, level: 2 })
      .locator('xpath=ancestor::section[1]');
    await expect(forgePanel.getByText(/→/).first()).toBeVisible();

    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: /Forge floor −/i }).click();
    }
    await expect(await readForgeFloorValue(page)).toBe('0');
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expect(forgePanel.getByText(/Nothing to forge at this floor/i)).toBeVisible();
  });

  test('move list orders unequips before equips', async ({ page }) => {
    const phases = await page.locator('[data-move-phase]').evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('data-move-phase')),
    );
    if (phases.length === 0) {
      await expect(page.getByText(/No gear moves proposed/i)).toBeVisible();
      return;
    }
    const lastUnequip = phases.lastIndexOf('unequip');
    const firstEquip = phases.indexOf('equip');
    if (firstEquip === -1) expect(lastUnequip).toBeGreaterThanOrEqual(0);
    else expect(lastUnequip).toBeLessThan(firstEquip);
  });

  test('point reset list is hidden until expanded', async ({ page }) => {
    const title = page.getByRole('heading', { name: /^Point resets$/i });
    await expect(title).toBeVisible();
    await expect(page.getByText(/from a reset/i)).toHaveCount(0);
    await title.click();
    const panel = title.locator('xpath=ancestor::section[1]');
    const items = panel.locator('li');
    const count = await items.count();
    const empty = panel.getByText(/No point reset buys extra DPS/i);
    expect(count > 0 || (await empty.isVisible())).toBe(true);
  });
});
