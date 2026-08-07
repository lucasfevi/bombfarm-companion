import { test, expect } from '@playwright/test';
import { gearPlanFixtureSeed } from './fixtures/gear-plan-seed';
import { seedLocalStorage, selectSavedHero } from './fixtures/seed';
import {
  clickOptimize,
  gotoGearPlan,
  pinPlannerStorageForNavigation,
  snapshotHeroesJson,
  waitForOptimizeDone,
} from './fixtures/gear-plan-e2e';

test.describe('Gear plan alt loadout push', () => {
  test('confirm push populates clone comparison and preserves other hero fields on reload', async ({
    page,
  }) => {
    const seed = gearPlanFixtureSeed('en');
    await seedLocalStorage(page, seed);
    const baseline = JSON.parse(JSON.stringify(seed.heroes)) as {
      id: string;
      name: string;
      level: number;
    }[];

    await gotoGearPlan(page);
    await clickOptimize(page);
    await waitForOptimizeDone(page);

    await page.getByRole('button', { name: /Send to alt loadout/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /Update \d+ hero/i }).click();
    await expect(dialog).toBeHidden();

    const afterPush = JSON.parse(await snapshotHeroesJson(page)) as {
      id: string;
      name: string;
      altLoadout?: unknown;
    }[];
    const updated = afterPush.find((hero) => hero.altLoadout != null);
    expect(updated).toBeTruthy();

    await pinPlannerStorageForNavigation(page);
    await page.goto('/');
    await selectSavedHero(page, updated!.name);
    await page.getByRole('tab', { name: /^Gear$/i }).click();
    await expect(page.getByRole('heading', { name: /^Gear compare$/i })).toBeVisible();

    const after = JSON.parse(await snapshotHeroesJson(page)) as {
      id: string;
      name: string;
      level: number;
      altLoadout?: unknown;
    }[];
    for (const hero of baseline) {
      const saved = after.find((row) => row.id === hero.id);
      expect(saved?.name).toBe(hero.name);
      expect(saved?.level).toBe(hero.level);
    }
  });

  test('cancel push writes nothing', async ({ page }) => {
    await seedLocalStorage(page, gearPlanFixtureSeed('en'));
    await gotoGearPlan(page);
    const before = await snapshotHeroesJson(page);

    await clickOptimize(page);
    await waitForOptimizeDone(page);
    await page.getByRole('button', { name: /Send to alt loadout/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('button.border-line', { hasText: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    const after = await snapshotHeroesJson(page);
    expect(after).toBe(before);
  });
});
