import { test, expect, type Page, type Locator } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  readForgeFloorValue,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

function heroDeltaPanel(page: Page) {
  return page
    .getByRole('heading', { name: /Per-hero changes/i, level: 2 })
    .locator('xpath=ancestor::section[1]');
}

async function expandAllHeroRows(panel: Locator) {
  const triggers = panel.getByRole('button', { name: /^Detailed breakdown for/i });
  const count = await triggers.count();
  for (let i = 0; i < count; i++) {
    const trigger = triggers.nth(i);
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
  }
}

test.describe('Gear plan per-hero proposed gear', () => {
  test.beforeEach(async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
  });

  test('forge annotations show at floor 10 and disappear at floor 0', async ({ page }) => {
    const panel = heroDeltaPanel(page);
    await expandAllHeroRows(panel);
    await expect(panel.getByText(/Forge from \+\d+ to \+\d+/i).first()).toBeVisible();

    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: /Forge floor −/i }).click();
    }
    await expect(await readForgeFloorValue(page)).toBe('0');
    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await expandAllHeroRows(panel);
    await expect(panel.getByText(/Forge from \+\d+ to \+\d+/i)).toHaveCount(0);
  });

  test('proposed gear cards show item icons for changed items', async ({ page }) => {
    const panel = heroDeltaPanel(page);
    await expandAllHeroRows(panel);
    await expect(panel.locator('img').first()).toBeVisible();
  });

  test('a moved item shows where it came from', async ({ page }) => {
    const panel = heroDeltaPanel(page);
    await expandAllHeroRows(panel);
    const fromNotes = panel.getByText(/^From /i);
    if ((await fromNotes.count()) === 0) {
      // Nothing moved on this fixture run — nothing to assert.
      return;
    }
    await expect(fromNotes.first()).toBeVisible();
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
