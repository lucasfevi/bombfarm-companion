import { test, expect } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero } from './fixtures/seed';

function activePanel(page: import('@playwright/test').Page) {
  return page.locator('[data-slot="tabs-panel"][data-state="active"]');
}

test.describe('planner tabs IA (PTI)', () => {
  test('tab list exposes Abilities / Gear / Account / Points (no Check)', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    for (const name of [/^Abilities$/i, /^Gear$/i, /^Account$/i, /^Points$/i]) {
      await expect(page.getByRole('tab', { name })).toBeVisible();
    }
    await expect(page.getByRole('tab', { name: /^Check$/i })).toHaveCount(0);
  });

  test('Points tab stacks Points / Next point then Stats then Effective', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    await page.getByRole('tab', { name: /^Points$/i }).click();
    const stage = activePanel(page);
    await expect(stage.getByRole('heading', { name: /^Points$/i, level: 2 })).toBeVisible();
    await expect(stage.getByRole('heading', { name: /^Next point$/i, level: 2 })).toBeVisible();
    await expect(stage.getByRole('heading', { name: /^Stats$/i, level: 2 })).toBeVisible();
    await expect(stage.getByRole('heading', { name: /^Effective stats$/i, level: 2 })).toBeVisible();
    await expect(stage.getByRole('heading', { name: /^Math check$/i })).toHaveCount(0);
  });

  test('Gear tab includes Items subsection (Stats lives on Points)', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^Gear$/i }).click();

    const stage = activePanel(page);
    await expect(stage.getByRole('heading', { name: /^Items$/i, level: 2 })).toBeVisible();
    await expect(stage.getByRole('heading', { name: /^Stats$/i, level: 2 })).toHaveCount(0);
    await expect(stage.getByRole('heading', { name: /Gear compare/i })).toBeVisible();
  });

  test('Points / Next point facts pair side-by-side above 720px', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    await page.getByRole('tab', { name: /^Points$/i }).click();
    let stage = activePanel(page);
    let pointsH = stage.getByRole('heading', { name: /^Points$/i, level: 2 });
    let nextH = stage.getByRole('heading', { name: /^Next point$/i, level: 2 });
    let pointsBox = await pointsH.boundingBox();
    let nextBox = await nextH.boundingBox();
    expect(pointsBox).toBeTruthy();
    expect(nextBox).toBeTruthy();
    expect(Math.abs(pointsBox!.y - nextBox!.y)).toBeLessThan(8);
    expect(nextBox!.x).toBeGreaterThan(pointsBox!.x + 80);

    await page.setViewportSize({ width: 500, height: 900 });
    await page.getByRole('tab', { name: /^Points$/i }).click();
    stage = activePanel(page);
    pointsH = stage.getByRole('heading', { name: /^Points$/i, level: 2 });
    nextH = stage.getByRole('heading', { name: /^Next point$/i, level: 2 });
    pointsBox = await pointsH.boundingBox();
    nextBox = await nextH.boundingBox();
    expect(nextBox!.y).toBeGreaterThan(pointsBox!.y + 40);
  });

  test('tab status dots + hover tooltips; no in-flow banners', async ({ page }) => {
    await seedLocalStorage(page, {
      ...importedRoster,
      lang: 'en',
      heroes: importedRoster.heroes,
    });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    const pointsTab = page.getByRole('tab', { name: /^Points$/i });
    await expect(pointsTab.locator('[data-tab-badge="soft"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Check$/i })).toHaveCount(0);
    // Gear is soft-only now (empty loadout). Its warn tier was the sheet Δ mismatch, which
    // retired with the read-only birth→Total Stats table; Points owns the only warn tier.
    await expect(page.getByRole('tab', { name: /^Gear$/i }).locator('[data-tab-badge="warn"]')).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /^Gear$/i }).locator('[data-tab-badge="soft"]')).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Abilities$/i }).locator('[data-tab-badge="soft"]')).toBeVisible();
    await expect(page.locator('[data-tab-status-banner]')).toHaveCount(0);

    await page.getByRole('tab', { name: /^Gear$/i }).hover();
    const gearTip = page.locator('[data-slot="tooltip-popup"][data-open]');
    await expect(gearTip).toBeVisible();
    await expect(gearTip.getByText(/Equip at least one item/i)).toBeVisible();
    // The mismatch issue string (tabGearMismatch) was deleted with the warn tier.
    await expect(gearTip.getByText(/match items \+ points/i)).toHaveCount(0);

    await page.getByRole('tab', { name: /^Abilities$/i }).hover();
    const abilitiesTip = page.locator('[data-slot="tooltip-popup"][data-open]');
    await expect(abilitiesTip).toBeVisible();
    await expect(abilitiesTip.getByText(/ability points/i)).toBeVisible();

    await pointsTab.hover();
    const pointsTip = page.locator('[data-slot="tooltip-popup"][data-open]');
    await expect(pointsTip).toBeVisible();
    await expect(pointsTip.getByText(/Finish setup before trusting the ranking/i)).toBeVisible();
    await expect(pointsTip.getByText(/observed normal hit/i)).toHaveCount(0);
    await expect(pointsTip.getByText(/Spend remaining points/i)).toBeVisible();

    await page.getByRole('tab', { name: /^Points$/i }).click();
    await expect(page.locator('[data-tab-status-banner]')).toHaveCount(0);
    await expect(
      activePanel(page).getByRole('heading', { name: /Finish setup before trusting the ranking/i }),
    ).toHaveCount(0);
  });

  test('no Context panel heading anywhere', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    await expect(page.getByRole('heading', { name: /^Context$/i, level: 2 })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /^Contexto$/i, level: 2 })).toHaveCount(0);
  });
});

test.describe('HeroStrip reset-advice warn chrome + roster banner', () => {
  // Confirmed directly against computeAdvisorPipeline (not guessed): pts.cdr = level fires the
  // reset gate (~251% gainPct) on this seeded hero; pts.attack = level does not (~0%).
  function heroStripHero(pts: Record<string, number>) {
    return {
      ...importedRoster,
      lang: 'en' as const,
      heroes: importedRoster.heroes.map((h) => (h.id === 'seed-cora' ? { ...h, level: 38, pts } : h)),
    };
  }
  const firingPts = {
    attack: 0,
    energy: 0,
    speed: 0,
    critChance: 0,
    critDmg: 0,
    penetration: 0,
    cdr: 38,
    luck: 0,
  };
  const quietPts = {
    attack: 38,
    energy: 0,
    speed: 0,
    critChance: 0,
    critDmg: 0,
    penetration: 0,
    cdr: 0,
    luck: 0,
  };

  function heroStripSection(page: import('@playwright/test').Page) {
    return page.getByRole('region', { name: /current hero/i });
  }

  test('warn border shows when the gate fires; not when it does not', async ({ page }) => {
    await seedLocalStorage(page, heroStripHero(firingPts));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    const firing = heroStripSection(page);
    await expect(firing).toHaveClass(/border-\[color-mix/);
    await expect(firing).not.toHaveClass(/\bborder-line\b/);

    await seedLocalStorage(page, heroStripHero(quietPts));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    const quiet = heroStripSection(page);
    await expect(quiet).toHaveClass(/\bborder-line\b/);
    await expect(quiet).not.toHaveClass(/border-\[color-mix/);
  });

  test('roster banner names the hero with level and Optimize build when the gate fires', async ({
    page,
  }) => {
    await seedLocalStorage(page, heroStripHero(firingPts));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    const banner = page.getByRole('status').filter({ hasText: /Cora \(Lv 38\)/i });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/sustained DPS/i);
    await expect(banner).toContainText(/Optimize build/i);
    await expect(banner).toContainText(/Points/i);
  });

  test('roster banner is absent when no hero triggers the gate', async ({ page }) => {
    await seedLocalStorage(page, heroStripHero(quietPts));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    await expect(page.getByRole('status').filter({ hasText: /Optimize build/i })).toHaveCount(0);
  });

  test('delete is the only icon control in the strip action column', async ({ page }) => {
    await seedLocalStorage(page, heroStripHero(firingPts));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    const strip = heroStripSection(page);
    await expect(strip.getByRole('button', { name: /delete hero/i })).toBeVisible();
    await expect(strip.getByRole('button', { name: /possible dps gain/i })).toHaveCount(0);
  });

  test('Points tab warn-dots when the reset gate fires', async ({ page }) => {
    await seedLocalStorage(page, heroStripHero(firingPts));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    await expect(page.getByRole('tab', { name: /^Points$/i }).locator('[data-tab-badge="warn"]')).toBeVisible();
  });

  test('the strip bounding box is identical whether the gate fires or not (box metrics)', async ({
    page,
  }) => {
    await seedLocalStorage(page, heroStripHero(firingPts));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    const firingBox = await heroStripSection(page).boundingBox();

    await seedLocalStorage(page, heroStripHero(quietPts));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    const quietBox = await heroStripSection(page).boundingBox();

    expect(firingBox).toBeTruthy();
    expect(quietBox).toBeTruthy();
    expect(firingBox!.width).toBe(quietBox!.width);
    expect(firingBox!.height).toBe(quietBox!.height);
  });

  test('no required-field chrome: no FieldRequired badge, no warn outline on an input', async ({
    page,
  }) => {
    await seedLocalStorage(page, heroStripHero(firingPts));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    const strip = heroStripSection(page);
    await expect(strip.getByText(/required/i)).toHaveCount(0);
    const warnInputs = strip.locator('input.border-warn, [data-num].border-warn');
    await expect(warnInputs).toHaveCount(0);
  });
});
