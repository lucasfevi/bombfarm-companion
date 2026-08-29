import { beforeEach, describe, expect, it } from 'vitest';
import { parseSaveFile } from '@bombfarm/domain/import-save';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import { FARM_RESPEC_MIN_GAIN_PCT } from '@bombfarm/domain/farm-optimize';
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
import { holdSuiteUntilInRegime } from '../../../../packages/domain/tests/helpers/capture-regime';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';

/**
 * Loads `save-20260819-11882-7heroes.json` through the SAME path the shell's real import dialog uses
 * (`useImportCandidates.handleConfirm`, `app-shell-inner.tsx`'s `handleImported`):
 * `parseSaveFile` -> `importHeroes` -> `setHeroes` + `applyAccountImport`. This is the committed
 * committed corpus, shared byte-identically with `packages/domain`'s own fixture tree
 * (`docs/fixture-corpus.md`), and it carries the `account` block with a `max_phase` that
 * `e2e/fixtures/sample-save.json` cannot stand in for.
 *
 * RE-POINTED off `save-20260813-5heroes.json` (issue #206). Three of this file's claims were
 * disabled against that capture, and the reason was written into the first one at the time:
 * two of its five heroes carry an ILLEGAL build (Jon spends 44 points at level 38, Bellatrix 46
 * at 42), the search clamps candidates to the legal budget, and so the illegal current build
 * out-scored everything reachable. The advisor was being characterised against an account the
 * game cannot produce. This capture is legal on all 7 heroes.
 */
function importFixtureIntoStore(): void {
  const raw = loadFixtureJson('save-20260819-11882-7heroes.json');
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

holdSuiteUntilInRegime('sheet-math/save-20260819-11882-7heroes.json', 'sheet');

describe('Farm Respec Advisor — fixture integration (save-20260819-11882-7heroes.json)', () => {
  beforeEach(() => {
    resetPlannerStoreForTests();
    resetFarmRankingCache();
    resetFarmRankingComputeCount();
    resetFarmRespecGateComputeCount();
    resetFarmRespecSolveCount();
    resetFarmRespecRowsComputeCount();
    importFixtureIntoStore();
  });

  /**
   * INVERTED, and the inversion is the finding (issue #206). This used to assert the banner stays
   * QUIET, and the reason had been traced in the comment it carried: the retired capture's own
   * current build was ILLEGAL, so once the search clamped candidates to the legal point budget the
   * illegal build out-scored everything reachable and Tier 1 honestly reported no gain — 0%.
   *
   * On a legal account the advisor does what it is for. Tier 1's lower bound clears the 1%
   * threshold comfortably and the banner surfaces. Both directions are asserted rather than the
   * one that happens to hold: `shouldSurface` must agree with the comparison against the
   * threshold, so this stays a real test whichever side a future account lands on.
   */
  it('Tier 1 surfaces on a legal account, and shouldSurface agrees with the threshold', () => {
    const gate = selectFarmRespecGate(usePlannerStore.getState());
    expect(gate.reason).toBeNull();
    expect(gate.result).not.toBeNull();
    expect(gate.result!.gainPct).toBeGreaterThan(FARM_RESPEC_MIN_GAIN_PCT);
    expect(gate.shouldSurface).toBe(gate.result!.gainPct >= FARM_RESPEC_MIN_GAIN_PCT);
    expect(gate.shouldSurface).toBe(true);
    // Non-vacuity: the gate RAN and reached a considered terminal state rather than erroring
    // into a default — a null reason and a non-null outcome together prove it.
    expect(gate.result!.outcome).toBe('improved');
  });

  it('Tier 1 is a lower bound: gainIsLowerBound is true and its gain never exceeds Tier 2\'s', () => {
    const gate = selectFarmRespecGate(usePlannerStore.getState());
    const solve = runFarmRespecSolve(usePlannerStore.getState());
    expect(gate.result?.gainIsLowerBound).toBe(true);
    expect(gate.result!.gainPct).toBeLessThanOrEqual(solve.gainPct);
  });

  // The 26-28 band was a property of the retired capture's own strength, not of the advisor.
  // This account's `max_phase` is 52 and the solver recommends staying at its ceiling, so what is
  // asserted is the relation to the cap — which is the part that transfers between accounts.
  it("the recommended phase lands at the account's reachable ceiling, and the measured gain is at least 5% and finite", () => {
    const solve = runFarmRespecSolve(usePlannerStore.getState());
    expect(solve.recommendedPhase).not.toBeNull();
    expect(solve.recommendedPhase).toBeGreaterThanOrEqual(51);
    expect(solve.recommendedPhase).toBeLessThanOrEqual(52);
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

  /**
   * A RECORDED LOSS with a weaker claim in its place (issue #206). This used to assert that
   * re-ranking MOVES the board's top-by-gold row — off phase X and into the 26-28 band. On this
   * account it does not: the proposed build is worth ~7% more gold per hour, but it is worth more
   * AT THE SAME PHASE (51, the account's own ceiling), so the argmax does not move at all.
   *
   * That is a real property of a maxed-out account rather than a defect, and it is not something
   * a different in-regime capture obviously fixes — the 11-hero one also argmaxes at a single
   * clear peak. So what is asserted is the part that must be true for the toggle to mean
   * anything: re-rank actually re-prices the board. The stronger "the pick moves" form needs an
   * account whose respec changes which phase is worth farming.
   */
  it('re-rank re-prices the board — the proposed rows differ from the current ones', () => {
    const state = usePlannerStore.getState();
    const currentRows = selectFarmBoardRows(state).rows;
    const currentTop = topGoldPhase(currentRows);
    const currentTopGold = currentRows.find((row) => row.phase === currentTop)!.goldPerHour;

    const solve = runFarmRespecSolve(usePlannerStore.getState());
    usePlannerStore.setState({
      farmRespecProposal: { deps: readFarmRespecDepTuple(usePlannerStore.getState()), result: solve },
      farmRespecStatus: 'done',
    });
    usePlannerStore.getState().setFarmRespecReRank(true);
    const proposedRows = selectFarmBoardRows(usePlannerStore.getState()).rows;
    const proposedTop = topGoldPhase(proposedRows);
    const proposedTopGold = proposedRows.find((row) => row.phase === proposedTop)!.goldPerHour;

    expect(proposedTopGold).toBeGreaterThan(currentTopGold);
    // Non-vacuity: the toggle reached the board, not just the banner — some row's rate moved.
    expect(proposedRows.map((row) => row.goldPerHour)).not.toEqual(currentRows.map((row) => row.goldPerHour));
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
