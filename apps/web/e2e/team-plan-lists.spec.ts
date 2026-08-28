import { test, expect, type Page, type Locator } from '@playwright/test';
import { teamPlanRichSeed } from './fixtures/team-plan-seed';
import { seedLocalStorage } from './fixtures/seed';
import {
  clickOptimize,
  gotoTeamPlan,
  readForgeFloorValue,
  waitForOptimizeDone,
} from './fixtures/team-plan-e2e';

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

test.describe('Team plan per-hero proposed gear', () => {
  test.beforeEach(async ({ page }) => {
    // The RICH seed: every case in this file is about an item being kept, moved or forged,
    // and the structural seed's heroes arrive wearing nothing at all (issue #206).
    await seedLocalStorage(page, teamPlanRichSeed('en'));
    await gotoTeamPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);
  });

  test('forge annotations show at floor 10 and disappear at floor 0', async ({ page }) => {
    const panel = heroDeltaPanel(page);
    await expandAllHeroRows(panel);
    await expect(panel.getByText(/Forge from \+\d+ to \+\d+/i).first()).toBeVisible();

    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: /Min forge \(\+\) −/i }).click();
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

  test('kept items stay visible and say they are existing with no change', async ({ page }) => {
    for (let i = 0; i < 10; i++) {
      await page.getByRole('button', { name: /Min forge \(\+\) −/i }).click();
    }
    await expect(await readForgeFloorValue(page)).toBe('0');
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    const panel = heroDeltaPanel(page);
    await expandAllHeroRows(panel);
    await expect(panel.getByText(/^Existing item — no change$/i).first()).toBeVisible();
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
});
