import { test, expect, type Page } from '@playwright/test';
import { seedLocalStorage, selectSavedHero, type SeededState } from './fixtures/seed';

/**
 * `BSPW6-05` (`AC-25`, `AC-26`) — sheet magnitudes at 2 dp, `×` multiplier chips at 3 dp.
 * A self-contained hero (not `seed-cora`) so the fixture values below are exact and
 * predictable: no gear, no tree, no team buffs — only `pts.speed` drives the one ratio
 * chip this suite checks.
 */
function precisionHero(): SeededState {
  const naked = {
    attack: 123.456,
    energy: 200,
    speed: 50,
    critChance: 10,
    critDmg: 80,
    penetration: 5,
    cdr: 4,
    luck: 12.345,
  };
  return {
    heroes: [
      {
        id: 'seed-precision',
        name: 'Precision',
        updatedAt: 1,
        rarity: 'Raro',
        level: 1,
        stars: 0,
        naked,
        birth: naked,
        loadout: {
          arma: null,
          elmo: null,
          anel: null,
          amuleto: null,
          peito: null,
          calca: null,
          luva: null,
          bota: null,
        },
        altLoadout: null,
        gearedOverride: naked,
        abilities: {},
        // 25 points x 2%/pt = +50% -> speed total = 50 x 1.5 = 75
        pts: {
          attack: 0,
          energy: 0,
          speed: 25,
          critChance: 0,
          critDmg: 0,
          penetration: 0,
          cdr: 0,
          luck: 0,
        },
        sourceId: 'seed-precision-save',
        deployed: false,
      },
    ],
    activeHeroId: 'seed-precision',
    lang: 'en',
    guideHidden: true,
    account: {
      tree: {
        danoTotal: 1,
        critChance: 0,
        critDmg: 0,
        speed: 0,
        energy: 0,
        teamCoinPct: 0,
      },
      teamBuffs: {},
      context: {
        houseIdx: 0,
        houseLevel: 0,
        phase: 1,
        mitigationPct: 1,
        cycleModel: 'serial',
        walkDelay: 0.15,
        extraDmgPct: 0,
        rankMode: 'dps',
        targetProp: 'bush',
      },
    },
  };
}

function activePanel(page: Page) {
  return page.locator('[data-slot="tabs-panel"][data-state="active"]');
}

test.describe('display precision sweep (BSPW6-05, AC-25, AC-26)', () => {
  test('sheet table Birth column renders at 2 dp for a known fixture value', async ({ page }) => {
    await seedLocalStorage(page, precisionHero());
    await page.goto('/');
    await selectSavedHero(page, 'Precision');
    await page.getByRole('tab', { name: /^Points$/i }).click();

    const stats = activePanel(page).locator('section').filter({
      has: page.getByRole('heading', { name: /^Stats$/i, level: 2 }),
    });
    await expect(stats.getByRole('columnheader', { name: /^Birth$/i })).toBeVisible();
    await expect(stats.getByRole('columnheader', { name: /^Total$/i })).toBeVisible();
    const attackRow = stats.locator('tr').filter({ hasText: /^Attack/ });
    // birth.attack = 123.456 -> "123.46" at 2 dp (never "123.5" or "123.456").
    await expect(attackRow).toContainText('123.46');
    await expect(attackRow).not.toContainText('123.5');
    await expect(attackRow).not.toContainText('123.456');
  });

  test('sheet table shows a Luck row (BSP-44, AC-19)', async ({ page }) => {
    await seedLocalStorage(page, precisionHero());
    await page.goto('/');
    await selectSavedHero(page, 'Precision');
    await page.getByRole('tab', { name: /^Points$/i }).click();

    const stats = activePanel(page).locator('section').filter({
      has: page.getByRole('heading', { name: /^Stats$/i, level: 2 }),
    });
    const luckRow = stats.locator('tr').filter({ hasText: /^Luck/ });
    // birth.luck = 12.345 -> "12.35" at 2 dp (BSP-29).
    await expect(luckRow).toContainText('12.35');
  });

  test('sheet table is read-only — no geared Num spinbuttons', async ({ page }) => {
    await seedLocalStorage(page, precisionHero());
    await page.goto('/');
    await selectSavedHero(page, 'Precision');
    await page.getByRole('tab', { name: /^Points$/i }).click();

    const stats = activePanel(page).locator('section').filter({
      has: page.getByRole('heading', { name: /^Stats$/i, level: 2 }),
    });
    await expect(stats.getByRole('spinbutton')).toHaveCount(0);
  });

  test('sheet table Total for Speed includes Δ points at 2 dp', async ({ page }) => {
    await seedLocalStorage(page, precisionHero());
    await page.goto('/');
    await selectSavedHero(page, 'Precision');
    await page.getByRole('tab', { name: /^Points$/i }).click();

    const stats = activePanel(page).locator('section').filter({
      has: page.getByRole('heading', { name: /^Stats$/i, level: 2 }),
    });
    const speedRow = stats.locator('tr').filter({ hasText: /^Speed/ });
    // birth 50 + 25 pts × 2% -> Total 75.00
    await expect(speedRow).toContainText('75.00');
    await expect(speedRow).toContainText('+25.00');
  });

  test('Points table After column renders at 2 dp', async ({ page }) => {
    await seedLocalStorage(page, precisionHero());
    await page.goto('/');
    await selectSavedHero(page, 'Precision');
    await page.getByRole('tab', { name: /^Points$/i }).click();

    // Scope to the Points *section*, not the tab panel: the read-only Stats table shares
    // this tab and has its own "Speed" row, so a panel-wide `tr` filter matches both.
    const pointsStage = activePanel(page)
      .locator('section')
      .filter({ has: page.getByRole('heading', { name: /^Points$/i, level: 2 }) });
    const speedRow = pointsStage.locator('tr').filter({ hasText: /^Speed/ });
    // pts.speed = 25 -> After = 75.00 exactly (2 dp, no truncation to 75 or 75.0).
    await expect(speedRow).toContainText('75.00');
  });

  test('Effective panel sheet group renders combat-delta Speed at 2 dp', async ({ page }) => {
    // Marcha adds a combat speed mult so Speed differs from sheet Total and stays listed.
    // Marcha's own cap (TEAM_BUFF_CAP.marcha_acelerada, packages/domain/src/team-buffs.ts) is
    // 3.7 — stay well under it so this seed reads as an unclamped rank, not a clamped one.
    const seeded = precisionHero();
    seeded.account = {
      ...seeded.account!,
      teamBuffs: { marcha_acelerada: 2 },
    };
    await seedLocalStorage(page, seeded);
    await page.goto('/');
    await selectSavedHero(page, 'Precision');
    await page.getByRole('tab', { name: /^Points$/i }).click();

    const effective = activePanel(page).locator('section').filter({
      has: page.getByRole('heading', { name: /^Effective stats$/i, level: 2 }),
    });
    const speedBtn = effective.getByRole('button', { name: /Show breakdown of Speed/i });
    // adjusted 75 × 1.02 Marcha → 76.50
    await expect(speedBtn).toContainText('76.50');
  });

  test('ledger step amounts (pctOfBase term) render at 2 dp', async ({ page }) => {
    const seeded = precisionHero();
    seeded.account = {
      ...seeded.account!,
      teamBuffs: { marcha_acelerada: 10 },
    };
    await seedLocalStorage(page, seeded);
    await page.goto('/');
    await selectSavedHero(page, 'Precision');
    await page.getByRole('tab', { name: /^Points$/i }).click();

    const effective = activePanel(page).locator('section').filter({
      has: page.getByRole('heading', { name: /^Effective stats$/i, level: 2 }),
    });
    await effective.getByRole('button', { name: /Show breakdown of Speed/i }).click();

    // The "points" step: 25 pts x 2%/pt of a 50.00 base -> "+ 50.00% × 50.00" (2 dp).
    // Matches both the claim line and its "→ ... =" proof line — either is proof of 2 dp.
    await expect(effective.getByText(/50\.00% × 50\.00/).first()).toBeVisible();
  });
});
