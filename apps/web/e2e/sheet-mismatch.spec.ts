import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero, type SeededState } from './fixtures/seed';

const zeroPts = () => ({
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
});

/** Divergent gearedOverride — used to prove Gear no longer sheet-mismatch-warns. */
function birthStatsState(lang: 'pt' | 'en'): SeededState {
  const sheet = {
    attack: 100,
    energy: 200,
    speed: 50,
    critChance: 10,
    critDmg: 150,
    penetration: 2,
    cdr: 5,
    luck: 0,
  };
  return {
    ...importedRoster,
    lang,
    heroes: importedRoster.heroes.map((h) =>
      h.id === 'seed-cora'
        ? {
            ...h,
            naked: sheet,
            birth: sheet,
            gearedOverride: { ...sheet, attack: 999 },
            abilities: {},
            pts: zeroPts(),
          }
        : h,
    ),
  };
}

test.describe('sheet birth breakdown (Points Stats)', () => {
  test('Stats table is read-only and shows Birth / Total headers (EN)', async ({ page }) => {
    await seedLocalStorage(page, birthStatsState('en'));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^points$/i }).click();

    const stats = page.locator('section').filter({
      has: page.getByRole('heading', { name: /^Stats$/i, level: 2 }),
    });
    await expect(stats.getByRole('columnheader', { name: /^Birth$/i })).toBeVisible();
    await expect(stats.getByRole('columnheader', { name: /^Total$/i })).toBeVisible();
    await expect(stats.getByRole('columnheader', { name: /BASEEQUIPADO/i })).toHaveCount(0);
    await expect(stats.getByRole('spinbutton')).toHaveCount(0);
    await expect(stats.getByRole('button', { name: /Why is Δ highlighted/i })).toHaveCount(0);

    // In-game sheet order: Luck sits after Speed, before Crit %.
    const bodyRows = stats.locator('tbody tr');
    await expect(bodyRows.nth(2)).toContainText(/^Speed/);
    await expect(bodyRows.nth(3)).toContainText(/^Luck/);
    await expect(bodyRows.nth(4)).toContainText(/^Crit/);
  });

  test('Stats table shows Ao nascer / Total headers (PT)', async ({ page }) => {
    await seedLocalStorage(page, birthStatsState('pt'));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^pontos$/i }).click();

    const stats = page.locator('section').filter({
      has: page.getByRole('heading', { name: /^Atributos$/i, level: 2 }),
    });
    await expect(stats.getByRole('columnheader', { name: /^Ao nascer$/i })).toBeVisible();
    await expect(stats.getByRole('columnheader', { name: /^Total$/i })).toBeVisible();
    await expect(stats.getByRole('spinbutton')).toHaveCount(0);
  });

  test('EN Gear tab does not warn for gearedOverride ≠ expected sheet', async ({ page }) => {
    await seedLocalStorage(page, birthStatsState('en'));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    const gearTab = page.getByRole('tab', { name: /^Gear$/i });
    // Gear has no warn tier any more: the sheet Δ mismatch dot retired with the read-only
    // birth→Total Stats table, even though this fixture's gearedOverride.attack (999)
    // diverges hard from the composed sheet. The soft dot that remains is the unrelated
    // "equip at least one item" issue — importedRoster's Cora has an empty loadout — so
    // assert on the tooltip body rather than the badge's absence.
    await expect(gearTab.locator('[data-tab-badge="warn"]')).toHaveCount(0);
    await expect(gearTab.locator('[data-tab-badge="soft"]')).toBeVisible();

    await gearTab.hover();
    const gearTip = page.locator('[data-slot="tooltip-popup"][data-open]');
    await expect(gearTip.getByText(/Equip at least one item/i)).toBeVisible();
    await expect(gearTip.getByText(/match items \+ points/i)).toHaveCount(0);

    await gearTab.click();
    await expect(page.locator('[data-tab-status-banner]')).toHaveCount(0);
  });
});
