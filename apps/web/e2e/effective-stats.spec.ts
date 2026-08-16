import { test, expect, type Page } from '@playwright/test';
import { importedRoster, seedLocalStorage, selectSavedHero } from './fixtures/seed';

async function openPointsTab(page: Page, lang: 'en' | 'pt') {
  const name = lang === 'en' ? /^points$/i : /^pontos$/i;
  await page.getByRole('tab', { name }).click();
}

function activePanel(page: Page) {
  return page.locator('[data-slot="tabs-panel"][data-state="active"]');
}

function pointsStage(page: Page, lang: 'en' | 'pt') {
  const title = lang === 'en' ? /^Points$/i : /^Pontos$/i;
  return activePanel(page).filter({
    has: page.getByRole('heading', { name: title, level: 2 }),
  });
}

function effectivePanel(page: Page, lang: 'en' | 'pt') {
  const title = lang === 'en' ? /^Effective stats$/i : /^Stats efetivos$/i;
  return activePanel(page).locator('section').filter({
    has: page.getByRole('heading', { name: title, level: 2 }),
  });
}

/**
 * Sheet stats that `combatSheetDeltaAccount` actually pushes off sheet Total: Attack via
 * `grito_guerra`, Speed via `marcha_acelerada`. Crit chance is deliberately NOT here —
 * `pressagio_mortal` is a `critChanceFlat` TEAM buff that `derive.ts` folds into the
 * crit factor, not into `effective.critChance`, so crit chance stays equal to Total and the
 * panel correctly hides it. The crit buff's visible home is the derived Critical factor /
 * Critical Hit rows, asserted separately below.
 */
const EN_COMBAT_SHEET_LABELS = ['Attack', 'Speed'] as const;

const PT_COMBAT_SHEET_LABELS = ['Ataque', 'Velocidade'] as const;

/** Account team buffs that push sheet stats off Total so they still appear under Effective. */
function combatSheetDeltaAccount(base: NonNullable<typeof importedRoster.account>) {
  return {
    ...base,
    teamBuffs: {
      ...base.teamBuffs,
      grito_guerra: 10,
      marcha_acelerada: 10,
      pressagio_mortal: 5,
    },
  };
}

const EN_DERIVED = [
  'Mitigation factor',
  'Damage multiplier',
  'Hit',
  'Critical Hit',
  'Critical factor',
  'Fuse',
  'Bombs / s',
  'Field time',
  'Rest',
  'Uptime',
  'Active DPS',
  'Sustained DPS',
] as const;

test.describe('effective stats panel (EST / ESB)', () => {
  test('Points tab stacks Points / Next point / Stats / Effective (EN + PT)', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const stage = pointsStage(page, 'en');
    const headings = stage.getByRole('heading', { level: 2 });
    await expect(headings.nth(0)).toHaveText(/^Points$/);
    await expect(headings.nth(1)).toHaveText(/^Next point$/);
    await expect(headings.nth(2)).toHaveText(/^Stats$/);
    await expect(headings.nth(3)).toHaveText(/^Effective stats$/);

    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'PT' }).click();
    await openPointsTab(page, 'pt');
    const stagePt = pointsStage(page, 'pt');
    const headingsPt = stagePt.getByRole('heading', { level: 2 });
    await expect(headingsPt.nth(0)).toHaveText(/^Pontos$/);
    await expect(headingsPt.nth(1)).toHaveText(/^Próximo ponto$/);
    await expect(headingsPt.nth(2)).toHaveText(/^Atributos$/);
    await expect(headingsPt.nth(3)).toHaveText(/^Stats efetivos$/);
  });

  test('hides sheet-group rows that match hero-sheet Total; shows combat deltas + derived', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const panel = effectivePanel(page, 'en');
    // Default Cora has no combat sheet mults — sheet group is omitted entirely.
    await expect(panel.getByRole('heading', { name: /Sheet stats/i, level: 3 })).toHaveCount(0);
    await expect(panel.getByRole('heading', { name: /Derived combat/i, level: 3 })).toBeVisible();
    for (const label of EN_DERIVED) {
      await expect(panel.getByRole('button', { name: new RegExp(label, 'i') }).first()).toBeVisible();
    }

    await seedLocalStorage(page, {
      ...importedRoster,
      lang: 'en',
      account: combatSheetDeltaAccount(importedRoster.account!),
    });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');
    const panelDelta = effectivePanel(page, 'en');
    await expect(panelDelta.getByRole('heading', { name: /Sheet stats/i, level: 3 })).toBeVisible();
    for (const label of EN_COMBAT_SHEET_LABELS) {
      await expect(panelDelta.getByRole('button', { name: new RegExp(label, 'i') }).first()).toBeVisible();
    }
    // Unchanged vs sheet Total (no combat mult) — stay hidden.
    await expect(panelDelta.getByRole('button', { name: /Show breakdown of Penetration/i })).toHaveCount(0);
    await expect(panelDelta.getByRole('button', { name: /Show breakdown of Luck/i })).toHaveCount(0);
    // Crit chance too: the pressagio_mortal team buff lands on the crit factor, not on the
    // sheet stat, so the sheet row stays equal to Total and is hidden — while the derived
    // Critical factor row it DOES feed remains listed.
    await expect(panelDelta.getByRole('button', { name: /Show breakdown of Crit Chance/i })).toHaveCount(0);
    await expect(panelDelta.getByRole('button', { name: /Show breakdown of Critical factor/i })).toBeVisible();

    await page.getByRole('group', { name: 'Language' }).getByRole('button', { name: 'PT' }).click();
    await openPointsTab(page, 'pt');
    const panelPt = effectivePanel(page, 'pt');
    await expect(panelPt.getByRole('heading', { name: /Stats da ficha/i, level: 3 })).toBeVisible();
    for (const label of PT_COMBAT_SHEET_LABELS) {
      await expect(panelPt.getByRole('button', { name: new RegExp(label, 'i') }).first()).toBeVisible();
    }
  });

  test('Points tab soft-badges when setup incomplete; Effective stays neutral', async ({ page }) => {
    await seedLocalStorage(page, {
      ...importedRoster,
      lang: 'en',
      heroes: importedRoster.heroes,
    });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');

    const pointsTab = page.getByRole('tab', { name: /^points$/i });
    await expect(pointsTab.locator('[data-tab-badge="soft"]')).toBeVisible();
    await expect(pointsTab.getByText(/^setup$/i)).toHaveCount(0);

    await openPointsTab(page, 'en');
    const effective = effectivePanel(page, 'en');
    await expect(effective).not.toHaveClass(/shadow-\[inset_3px_0_0_var\(--accent\)\]/);
    await expect(effective).not.toHaveClass(/opacity-\[0\.78\]/);
  });

  test('no Gates or Context headings in Points tab', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const stage = pointsStage(page, 'en');
    await expect(stage.getByRole('heading', { name: /^Gates$/i })).toHaveCount(0);
    await expect(stage.getByRole('heading', { name: /^Context$/i })).toHaveCount(0);
  });

  test('Hit updates when points change (sheet Attack stays on Stats when equal to Total)', async ({
    page,
  }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const panel = effectivePanel(page, 'en');
    const hitBtn = panel.getByRole('button', { name: /Show breakdown of Hit/i });
    const hitBefore = await hitBtn.textContent();

    const stage = pointsStage(page, 'en');
    const attackStepper = stage.locator('tr').filter({ hasText: /^Attack/ });
    await attackStepper.getByRole('button', { name: /\+/ }).click();

    const hitAfter = await hitBtn.textContent();
    expect(hitAfter).not.toBe(hitBefore);
  });

  test('expand sheet row shows ledger; expand derived shows formula', async ({ page }) => {
    await seedLocalStorage(page, {
      ...importedRoster,
      lang: 'en',
      account: combatSheetDeltaAccount(importedRoster.account!),
    });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const panel = effectivePanel(page, 'en');
    const attackBtn = panel.getByRole('button', { name: /Show breakdown of Attack/i });
    await attackBtn.click();
    // BSPW6-06/BSP-20: steps now name their GAME line (Hero/Gear/Ability/Skill tree,
    // LEDGER_SOURCE_GROUP), not the raw source — Attack's base+level+stars+points steps all
    // read "Hero" (the old "Level" line-item name is gone by design).
    await expect(panel.getByText(/^Hero$/i).first()).toBeVisible();
    await expect(panel.getByText(/^Gear$/i).first()).toBeVisible();

    const fuseBtn = panel.getByRole('button', { name: /Show breakdown of Fuse/i });
    await fuseBtn.click();
    await expect(panel.locator('code').filter({ hasText: /max\(2/ })).toBeVisible();
  });

  test('EN+PT: a stat with a real sheet ability + tree bonus shows all four game lines: Hero / Gear / Ability / Skill tree (AC-29, AC-30)', async ({
    page,
  }) => {
    // Attack structurally never gets an Ability line (its sheetOther is hardcoded 0 in
    // sheet-ledgers.ts) — Crit Chance does, via a sheet ability (Olho Clínico) and a tree
    // bonus, so it is the stat that actually exercises all four lines at once.
    const naked = {
      attack: 200,
      energy: 300,
      speed: 50,
      critChance: 10,
      critDmg: 70,
      penetration: 5,
      cdr: 5,
      luck: 0,
    };
    function seeded(lang: 'en' | 'pt') {
      return {
        ...importedRoster,
        lang,
        heroes: importedRoster.heroes.map((h) =>
          h.id === 'seed-cora'
            ? {
                ...h,
                naked,
                gearedOverride: { ...naked, critChance: 15 },
                abilities: { olho_clinico: 10 },
                pts: {
                  attack: 0,
                  energy: 0,
                  speed: 0,
                  critChance: 0,
                  critDmg: 0,
                  penetration: 0,
                  cdr: 0,
                  luck: 0,
                },
              }
            : h,
        ),
        account: {
          ...importedRoster.account!,
          tree: { ...importedRoster.account!.tree!, critChance: 6 },
          teamBuffs: { ...importedRoster.account!.teamBuffs, pressagio_mortal: 5 },
        },
      };
    }

    await seedLocalStorage(page, seeded('pt'));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await page.getByRole('tab', { name: /^pontos$/i }).click();
    const ptPanel = effectivePanel(page, 'pt');
    await ptPanel.getByRole('button', { name: /Ver detalhamento de Chance de Crítico/i }).click();
    await expect(ptPanel.getByText(/^Herói$/i).first()).toBeVisible();
    await expect(ptPanel.getByText(/^Itens$/i).first()).toBeVisible();
    await expect(ptPanel.getByText(/^Habilidade$/i).first()).toBeVisible();
    await expect(ptPanel.getByText(/^Árvore$/i).first()).toBeVisible();

    await seedLocalStorage(page, seeded('en'));
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');
    const enPanel = effectivePanel(page, 'en');
    await enPanel.getByRole('button', { name: /Show breakdown of Crit Chance/i }).click();
    await expect(enPanel.getByText(/^Hero$/i).first()).toBeVisible();
    await expect(enPanel.getByText(/^Gear$/i).first()).toBeVisible();
    await expect(enPanel.getByText(/^Ability$/i).first()).toBeVisible();
    await expect(enPanel.getByText(/^Skill tree$/i).first()).toBeVisible();
  });

  test('Luck lives on Stats (sheet Total), not Effective when equal to Total', async ({ page }) => {
    const naked = {
      attack: 200,
      energy: 300,
      speed: 50,
      critChance: 10,
      critDmg: 70,
      penetration: 5,
      cdr: 5,
      luck: 20,
    };
    // gearedOverride is the OBSERVED (tree-inclusive) sheet and still feeds roster/power,
    // but it no longer drives the Stats table — that composes from `birth` (asserted below).
    // Kept deliberately divergent from the composed Total so a regression that re-pointed
    // Stats at gearedOverride would show up as 25.00 instead of 43.00.
    const gearedOverride = { ...naked, luck: 25 };
    const seeded = {
      ...importedRoster,
      lang: 'en' as const,
      heroes: importedRoster.heroes.map((h) =>
        h.id === 'seed-cora'
          ? {
              ...h,
              naked,
              birth: naked,
              gearedOverride,
              abilities: {},
              pts: {
                attack: 0,
                energy: 0,
                speed: 0,
                critChance: 0,
                critDmg: 0,
                penetration: 0,
                cdr: 0,
                luck: 0,
              },
            }
          : h,
      ),
      account: {
        ...importedRoster.account!,
        tree: { ...importedRoster.account!.tree!, luckFlatPct: 3 },
      },
    };
    await seedLocalStorage(page, seeded);
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const stats = activePanel(page).locator('section').filter({
      has: page.getByRole('heading', { name: /^Stats$/i, level: 2 }),
    });
    const luckRow = stats.locator('tr').filter({ hasText: /^Luck/ });
    // Stats composes from birth now, not from gearedOverride: birth.luck 20 × starsMult(2)
    // = 40 (Δ stars +20.00), then the tree's flat luckFlatPct 3 (Δ tree +3.00) → Total 43.00.
    await expect(luckRow.locator('td').nth(1)).toHaveText('20.00');
    // Total is second-to-last: an "Over cap" column now trails it (rendered "—" for a stat
    // under its cap, and Luck has no cap at all), so `.last()` would read that instead.
    await expect(luckRow.locator('td').nth(-2)).toHaveText('43.00');

    const panel = effectivePanel(page, 'en');
    await expect(panel.getByRole('button', { name: /Show breakdown of Luck/i })).toHaveCount(0);
  });

  test('expand/collapse does not shift sibling value column (box metrics)', async ({ page }) => {
    await seedLocalStorage(page, { ...importedRoster, lang: 'en' });
    await page.goto('/');
    await selectSavedHero(page, 'Cora');
    await openPointsTab(page, 'en');

    const panel = effectivePanel(page, 'en');
    const hitBtn = panel.getByRole('button', { name: /Show breakdown of Hit/i });
    const before = await hitBtn.boundingBox();
    expect(before).toBeTruthy();

    await panel.getByRole('button', { name: /Show breakdown of Fuse/i }).click();
    const after = await hitBtn.boundingBox();
    expect(after).toBeTruthy();
    expect(Math.abs(after!.x + after!.width - (before!.x + before!.width))).toBeLessThan(2);
    expect(Math.abs(after!.x - before!.x)).toBeLessThan(2);
  });
});
