/* QUARANTINED (catalog v4, 2026-08-11): the assertions below are anchored to in-game
 * captures taken under the pre-v4 balance, on an account that has since been wiped —
 * they cannot be re-baselined without replacing game observations with our own output.
 * Un-skip once a post-update save export lands; `inferSpentPoints`' nonIntegerPoints
 * residual then also decides the open nv50+ Dano question (see gear/catalog.ts
 * composeAttack). Do NOT edit the numbers to make these pass. */
/**
 * Regression test for the second (missed) `TreeSheetTotals` construction site:
 * `selectTreeSheetTotals` (tree-sheet-selectors.ts) used to hardcode `critDmgMult: 1` and
 * never set `glassCannon`/`tempoDobrado` at all, so every hero sheet recomposed from store
 * state (`use-hero-build-actions`, `use-hero-draft-actions`, and — critically —
 * `buildTeamPlanInputFromStore`, which feeds the whole Team Plan scoring) ran keystone-free
 * even though the save-import path (`treeTotalsFromSave`) had already been corrected.
 *
 * This test goes THROUGH `selectTreeSheetTotals` itself (not around it, via
 * `treeTotalsFromSave` directly, the way `keystone-sheet-corrections.test.ts` in the domain
 * package already does) — it hydrates the real planner store via `parseSaveFile` +
 * `applyAccountImport` (the production import path, now carrying `critDmgMult` too), reads
 * the selector's output, and feeds it into `composeSheetFromBirth`, then compares against the
 * fixture's own exported `stats` block for Bellatrix (account.phase 452, all three keystones
 * owned: Glass Cannon C15, Tempo Dobrado V15, Abisso D15).
 *
 * NOTE on the specific numbers: the task brief that motivated this fix reported (from a live
 * app session) Bellatrix's buggy/correct Energy as 11555.81/5777.91, Speed as 86.34/103.72, and
 * Crit damage as 814.87/983.23. Recomposing directly from THIS COMMITTED fixture reproduces
 * the Energy pair exactly (11555.81 buggy / 5777.91 correct — Glass Cannon's ×0.5 on the whole
 * energy subtotal), and the exact per-keystone DELTAS the brief describes also match bit for
 * bit (Tempo Dobrado's speed contribution `birth.speed × 0.33333` = 17.38; Glass Cannon's
 * crit-damage contribution `birth.critDmg × starsMult(3)` = 168.36; both verified against the
 * fixture's own birth_stats below). But the ABSOLUTE Speed/Crit-damage totals this fixture's
 * gear+points produce (69.66/87.04 buggy/correct, 949.56/1117.92 buggy/correct) do not match
 * the brief's 86.34/103.72 and 814.87/983.23 — those two stats (unlike Energy) depend on
 * gear/points, which can differ between the live account state the brief was verified against
 * and this frozen fixture snapshot. This test asserts what the fixture and
 * `composeSheetFromBirth` actually, reproducibly agree on (matching the already-passing
 * `keystone-sheet-corrections.test.ts`), and separately pins the per-keystone deltas the brief
 * describes so the correction itself stays proven letter for letter.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import { composeSheetFromBirth } from '@bombfarm/domain/birth-sheet';
import { saveSheetUnits } from '@bombfarm/domain/save-units';
import { abilityMods } from '@bombfarm/domain/model';
import { emptySheetOther, starsMult, type SheetStats } from '@bombfarm/domain/gear';
import { STAT_CAPS } from '@bombfarm/domain/model';
import { SHEET_KEYS } from '@bombfarm/domain/planner-constants';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { selectTreeSheetTotals } from '@/shared/stores/selectors/tree-sheet-selectors';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const FIXTURE_PATH = join(
  WEB_PACKAGE_ROOT,
  '../../packages/domain/tests/fixtures/sheet-math/SaveFile_BombFarm.json',
);

function loadFixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Record<string, unknown>;
}

const SHEET_TOL = 1e-6;

/**
 * Mirrors the game's own sheet clamp (`STAT_CAPS.critChance`/`.cdr`), applied at comparison
 * time only, exactly like `keystone-sheet-corrections.test.ts` (packages/domain) — the model
 * is deliberately uncapped (`composeSheetFromBirth`'s own doc comment), and this fixture's
 * heavily-built Bellatrix exceeds `STAT_CAPS.cdr` from ability+gear alone.
 */
function gameSheetCap(sheet: SheetStats): SheetStats {
  return {
    ...sheet,
    critChance: Math.min(sheet.critChance, STAT_CAPS.critChance),
    cdr: Math.min(sheet.cdr, STAT_CAPS.cdr),
  };
}

function expectSheetsClose(actual: SheetStats, expected: SheetStats): void {
  for (const key of SHEET_KEYS) {
    expect(
      Math.abs(actual[key] - expected[key]),
      `${key}: got ${actual[key]} want ${expected[key]}`,
    ).toBeLessThanOrEqual(SHEET_TOL);
  }
}

describe.skip('selectTreeSheetTotals — keystone fields (SaveFile_BombFarm.json, account.phase 452)', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
  });

  afterEach(() => {
    resetPlannerStoreForTests();
  });

  it('carries all three keystones through applyAccountImport → the real store, sanity check', () => {
    const raw = loadFixture();
    const { account } = parseSaveFile(raw, []);
    usePlannerStore.getState().applyAccountImport(account);

    const treeSheet = selectTreeSheetTotals(usePlannerStore.getState());
    expect(treeSheet.critDmgMult).toBe(2);
    expect(treeSheet.glassCannon).toBe(true);
    expect(treeSheet.tempoDobrado).toBe(true);
  });

  it("Bellatrix L100: composeSheetFromBirth(selectTreeSheetTotals(store)) matches the game's exported stats block exactly", () => {
    const raw = loadFixture();
    const { account, candidates } = parseSaveFile(raw, []);
    usePlannerStore.getState().applyAccountImport(account);

    const bellatrix = candidates.find((c) => c.name === 'Bellatrix' && c.level === 100);
    if (!bellatrix) throw new Error('fixture missing Bellatrix L100');
    const { record } = bellatrix;
    if (!record.birth) throw new Error('Bellatrix must carry birth_stats');

    const mods = abilityMods(record.abilities);
    const sheetOther = {
      ...emptySheetOther(),
      critChance: mods.sheetCritChancePctOfBase / 100,
      penetration: mods.sheetPenetrationRaw,
      critDmg: mods.sheetCritDmgPctOfBase,
    };

    const treeSheet = selectTreeSheetTotals(usePlannerStore.getState());
    const composed = composeSheetFromBirth({
      birth: record.birth,
      level: record.level,
      stars: record.stars,
      sheetOther,
      loadout: record.loadout,
      pts: record.pts,
      tree: treeSheet,
    });

    const heroesRaw = raw.heroes as Record<string, unknown>[];
    const rawHero = heroesRaw.find((h) => h.name === 'Bellatrix' && h.level === 100);
    if (!rawHero) throw new Error('fixture missing raw Bellatrix L100');
    const exported = saveSheetUnits(rawHero.stats as Record<string, unknown>);

    expectSheetsClose(gameSheetCap(composed), exported);

    // The three keystone-corrected numbers, rounded to the same 2dp the in-game UI shows.
    // Energy matches the task brief's verified live-app number exactly (Glass Cannon's ×0.5
    // on the whole energy subtotal has no gear/points dependency). Speed and crit damage are
    // this fixture's own reproducible totals — see the file-header note on why they differ
    // from the brief's absolute numbers (gear/points depend on account state, unlike Energy).
    expect(composed.energy).toBeCloseTo(5777.91, 2);
    expect(composed.speed).toBeCloseTo(87.04, 2);
    expect(composed.critDmg).toBeCloseTo(1117.92, 2);
  });

  it('Bellatrix L100: the per-keystone deltas match the task brief bit for bit, independent of gear/points', () => {
    const raw = loadFixture();
    const { account, candidates } = parseSaveFile(raw, []);
    usePlannerStore.getState().applyAccountImport(account);

    const bellatrix = candidates.find((c) => c.name === 'Bellatrix' && c.level === 100);
    if (!bellatrix) throw new Error('fixture missing Bellatrix L100');
    const { record } = bellatrix;
    if (!record.birth) throw new Error('Bellatrix must carry birth_stats');

    const mods = abilityMods(record.abilities);
    const sheetOther = {
      ...emptySheetOther(),
      critChance: mods.sheetCritChancePctOfBase / 100,
      penetration: mods.sheetPenetrationRaw,
      critDmg: mods.sheetCritDmgPctOfBase,
    };

    const treeSheet = selectTreeSheetTotals(usePlannerStore.getState());
    const buggyTreeSheet = { ...treeSheet, critDmgMult: 1, glassCannon: false, tempoDobrado: false };

    const correct = composeSheetFromBirth({
      birth: record.birth,
      level: record.level,
      stars: record.stars,
      sheetOther,
      loadout: record.loadout,
      pts: record.pts,
      tree: treeSheet,
    });
    const buggy = composeSheetFromBirth({
      birth: record.birth,
      level: record.level,
      stars: record.stars,
      sheetOther,
      loadout: record.loadout,
      pts: record.pts,
      tree: buggyTreeSheet,
    });

    // Glass Cannon halves the WHOLE energy subtotal — a pure ×2 ratio, no gear/points term.
    expect(correct.energy * 2).toBeCloseTo(buggy.energy, 6);
    expect(buggy.energy).toBeCloseTo(11555.81, 2);
    expect(correct.energy).toBeCloseTo(5777.91, 2);

    // Tempo Dobrado adds birth.speed × (1.33333 − 1) to the speed pool, on top of whatever
    // gear/points already contributed — so the DELTA (not the absolute total) is what the
    // task brief's "missing" column actually verified.
    const speedDelta = correct.speed - buggy.speed;
    expect(speedDelta).toBeCloseTo(record.birth.speed * (1.33333 - 1), 2);
    expect(speedDelta).toBeCloseTo(17.38, 2);

    // Glass Cannon's crit_dmg_mult adds birth.critDmg × starsMult(stars) × (2 − 1).
    const critDmgDelta = correct.critDmg - buggy.critDmg;
    expect(critDmgDelta).toBeCloseTo(record.birth.critDmg * starsMult(record.stars), 2);
    expect(critDmgDelta).toBeCloseTo(168.36, 2);
  });

  it('a store state with no keystones (save-20260731-11heroes.json) is untouched — glassCannon/tempoDobrado default false, critDmgMult defaults to 1', () => {
    const noKeystoneFixturePath = join(
      WEB_PACKAGE_ROOT,
      '../../packages/domain/tests/fixtures/sheet-math/save-20260731-11heroes.json',
    );
    const raw = JSON.parse(readFileSync(noKeystoneFixturePath, 'utf8')) as Record<string, unknown>;
    const { account } = parseSaveFile(raw, []);
    usePlannerStore.getState().applyAccountImport(account);

    const treeSheet = selectTreeSheetTotals(usePlannerStore.getState());
    expect(treeSheet.critDmgMult).toBe(1);
    expect(treeSheet.glassCannon).toBe(false);
    expect(treeSheet.tempoDobrado).toBe(false);
  });
});
