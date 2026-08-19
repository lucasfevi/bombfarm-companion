import { beforeEach, describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import { importHeroes } from '@/shared/lib/storage';
import {
  readFarmRespecDepTuple,
  resetFarmRankingCache,
  resetFarmRankingComputeCount,
  resetFarmRespecGateComputeCount,
  resetFarmRespecRowsComputeCount,
  resetFarmRespecSolveCount,
  runFarmRespecSolve,
  selectFarmBoardRows,
  selectFarmRespecGate,
} from '@/shared/stores/selectors/farm-ranking-selectors';
import { resetPlannerStoreForTests, usePlannerStore } from '@/shared/stores';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

/**
 * Loads `save-20260813-5heroes.json` through the SAME path the shell's real import dialog uses
 * (`useImportCandidates.handleConfirm`, `app-shell-inner.tsx`'s `handleImported`):
 * `parseSaveFile` -> `importHeroes` -> `setHeroes` + `applyAccountImport`. This is the committed
 * account-486 corpus, shared byte-identically with `packages/domain`'s own fixture tree
 * (`docs/fixture-corpus.md`), and it is the only fixture with an `account` block that carries a
 * `max_phase` — `e2e/fixtures/sample-save.json` cannot stand in for it.
 */
function importFixtureIntoStore(): void {
  const raw = loadFixtureJson('save-20260813-5heroes.json');
  const { candidates, account } = parseSaveFile(raw, []);
  const records = candidates
    .filter((candidate) => !candidate.blocked)
    .map((candidate) => ({ ...candidate.record, sourceId: candidate.sourceId }));
  const saveSourceIds = new Set(candidates.map((candidate) => candidate.sourceId));
  const { heroes } = importHeroes([], records, saveSourceIds);
  usePlannerStore.getState().setHeroes(heroes);
  if (account) usePlannerStore.getState().applyAccountImport(account);
}

/** Highest-gold/hr farmable (non-gate, feasible) row — a fixture-test-local stand-in for the
 *  board's own sort/filter pipeline, which is exercised for real by the Playwright suite. */
function topGoldPhase(rows: readonly FarmRateRow[]): number {
  const farmable = rows.filter((row) => !row.gate && !row.infeasible);
  return farmable.reduce((best, row) => (row.goldPerHour > best.goldPerHour ? row : best)).phase;
}

describe('Farm Respec Advisor — fixture integration (account-486, save-20260813-5heroes.json)', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingCache();
    resetFarmRankingComputeCount();
    resetFarmRespecGateComputeCount();
    resetFarmRespecSolveCount();
    resetFarmRespecRowsComputeCount();
    importFixtureIntoStore();
  });

  it('Tier 1 does not surface on this account — RE-MEASURED for issue #132', () => {
    // Tier 1 (findGateCandidate) is a cheap LOWER-BOUND estimate, and `reoptBudget`
    // (`points-reopt-core.ts`) now clamps to `level` no matter what — the deliberate reversal
    // from "not clamped" that also moved `farm-optimize-486.test.ts`'s measured gain down. On
    // this fixture the honest, clamped Tier 1 estimate is ~0.76%, below
    // `FARM_RESPEC_MIN_GAIN_PCT` (1%), so the gate correctly stays quiet even though the full
    // Tier 2 search (below) still finds a real, larger gain through a different reallocation.
    const gate = selectFarmRespecGate(usePlannerStore.getState());
    expect(gate.reason).toBeNull();
    expect(gate.result?.gainPct).toBeGreaterThan(0);
    expect(gate.result?.gainPct).toBeLessThan(1);
    expect(gate.shouldSurface).toBe(false);
  });

  it('Tier 1 is a lower bound: gainIsLowerBound is true and its gain never exceeds Tier 2\'s', () => {
    const gate = selectFarmRespecGate(usePlannerStore.getState());
    const solve = runFarmRespecSolve(usePlannerStore.getState());
    expect(gate.result?.gainIsLowerBound).toBe(true);
    expect(gate.result!.gainPct).toBeLessThanOrEqual(solve.gainPct);
  });

  it('the recommended phase lands in the 26-28 band, and the measured gain is at least 5% and finite', () => {
    const solve = runFarmRespecSolve(usePlannerStore.getState());
    expect(solve.recommendedPhase).not.toBeNull();
    expect(solve.recommendedPhase).toBeGreaterThanOrEqual(26);
    expect(solve.recommendedPhase).toBeLessThanOrEqual(28);
    expect(Number.isFinite(solve.gainPct)).toBe(true);
    expect(solve.gainPct).toBeGreaterThanOrEqual(5);
  });

  it('the respec cost is positive and equals the sum of the changed heroes\' own respecCostGold', () => {
    const solve = runFarmRespecSolve(usePlannerStore.getState());
    expect(solve.respecCostGold).toBeGreaterThan(0);
    const summed = solve.heroes
      .filter((hero) => hero.changed)
      .reduce((total, hero) => total + hero.respecCostGold, 0);
    expect(solve.respecCostGold).toBe(summed);
  });

  it('every enabled hero is present in the result, and at least one is unchanged', () => {
    // The fixture's own default roster has NO unchanged hero under the reverted
    // percent-of-base crit-chance/CDR model (issue #132) — every one of the 5 heroes here now
    // has at least one profitable reallocation. Construct the unchanged hero deliberately
    // instead: pre-respec the FIRST hero onto its own already-optimal proposal, leaving the
    // rest of the roster free to improve normally (same pattern as
    // `farm-optimize-core.test.ts`'s domain-side twin).
    const first = runFarmRespecSolve(usePlannerStore.getState());
    const enabledCount = first.heroes.length;
    const fixedHeroId = first.heroes[0].heroId;
    const fixedProposal = first.heroes[0].proposedPts;
    const patchedHeroes = usePlannerStore
      .getState()
      .heroes.map((hero) => (hero.id === fixedHeroId ? { ...hero, pts: fixedProposal } : hero));
    usePlannerStore.getState().setHeroes(patchedHeroes);

    const solve = runFarmRespecSolve(usePlannerStore.getState());
    expect(solve.heroes).toHaveLength(enabledCount);
    const unchanged = solve.heroes.find((hero) => !hero.changed);
    expect(unchanged, 'expected the pre-respecced hero to be unchanged').toBeDefined();
    expect(unchanged!.heroId).toBe(fixedHeroId);
  });

  it('luck is frozen: proposedPts.luck equals currentPts.luck for every hero', () => {
    const solve = runFarmRespecSolve(usePlannerStore.getState());
    for (const hero of solve.heroes) {
      expect(hero.proposedPts.luck).toBe(hero.currentPts.luck);
    }
  });

  it('re-rank moves the top-by-gold phase into the 26-28 band, away from the current build\'s top phase', () => {
    const state = usePlannerStore.getState();
    const currentTop = topGoldPhase(selectFarmBoardRows(state).rows);

    const solve = runFarmRespecSolve(usePlannerStore.getState());
    usePlannerStore.setState({
      farmRespecProposal: { deps: readFarmRespecDepTuple(usePlannerStore.getState()), result: solve },
      farmRespecStatus: 'done',
    });
    usePlannerStore.getState().setFarmRespecReRank(true);
    const proposedTop = topGoldPhase(selectFarmBoardRows(usePlannerStore.getState()).rows);

    expect(proposedTop).not.toBe(currentTop);
    expect(proposedTop).toBeGreaterThanOrEqual(26);
    expect(proposedTop).toBeLessThanOrEqual(28);
  });

  it('a pure chests objective recommends phase 1 with a null payback (the reachable never-a-glyph case)', () => {
    usePlannerStore.getState().setFarmObjective('chests');
    const solve = runFarmRespecSolve(usePlannerStore.getState());
    expect(solve.recommendedPhase).toBe(1);
    expect(solve.paybackHours).toBeNull();
  });

  it('the frontier is non-empty on this multi-searchable-hero fixture and is cost-ascending', () => {
    const solve = runFarmRespecSolve(usePlannerStore.getState());
    expect(solve.frontier.length).toBeGreaterThan(0);
    for (let index = 1; index < solve.frontier.length; index++) {
      expect(solve.frontier[index].respecCostGold).toBeGreaterThanOrEqual(
        solve.frontier[index - 1].respecCostGold,
      );
    }
    // The rendered-order-equals-array-order pass-through guarantee (never re-sorted locally)
    // is proved at the layer that would be tempted to re-sort: farm-respec-view.test.ts (T6)
    // and the frontier component's own source scan (T11/T12).
  });
});
