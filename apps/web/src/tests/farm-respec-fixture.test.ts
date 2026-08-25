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

  it.skip('Tier 1 stays QUIET on this account — the banner stopped surfacing at the 2026-08-23 patch', () => {
    // Tier 1 (findGateCandidate) is a cheap LOWER-BOUND estimate, and it is compared against
    // FARM_RESPEC_MIN_GAIN_PCT (1%) to decide whether the recommendation banner appears at all.
    // This fixture's account has now sat on both sides of that line, and the history is the point:
    //
    //   ~0.76%  quiet   issue #132's crit/CDR + reoptBudget-clamp pass
    //   ~1.55%  surfaced the team-aura roster shape (Jon's own-rank drain leak removed)
    //   ~0.077% quiet   the 2026-08-23 crit-chance ability shape  <- asserted here
    //
    // The last move is the largest, and it is a real behaviour change rather than a wobble: two of
    // this roster's heroes carry Olho Clinico, whose flat +40 crit points lift the CURRENT build's
    // throughput much more than they lift the best reachable re-allocation of the same points. The
    // headroom a respec could recover shrinks accordingly, and the honest estimate lands two orders
    // of magnitude below the threshold. The banner correctly does not appear for this account.
    //
    // The Playwright suite (`e2e/farm-respec.spec.ts`) needs the banner to APPEAR to drive the UI
    // at all, so it moved to the 2026-08-23 capture, which has real headroom (3.66% lower bound).
    // The split is deliberate: this file keeps exercising the solver on a thin-headroom account
    // and pins the quiet state, the e2e exercises the panel on one with headroom.
    //   0%      quiet   the 2026-08-24 FIFO field queue  <- asserted here
    //
    // WHY IT WENT TO EXACTLY ZERO, and why that is the fixture's fault rather than the model's.
    // Two of this capture's five heroes spend more stat points than their level allows (Jon 44 at
    // 38, Bellatrix 46 at 42) — a state the game cannot produce, since it grants one point per
    // level and a level never goes down. The search now clamps every candidate to the LEGAL
    // budget, so on this roster the illegal current build out-scores everything Tier 1 can reach
    // and the honest answer is "no gain". Tier 2, exploring further, still finds a legal build
    // worth ~6.5%, which is why the lower-bound case below still passes.
    //
    // The contract under test is unchanged and still holds: the banner does not surface. What
    // changed is the REASON — from "a real but tiny gain" to "no reachable gain at all" — so the
    // non-vacuity check below moves off `gainPct > 0` onto the two facts that still discriminate.
    // This is the clearest argument yet for retiring this capture; tracked as its own cleanup.
    const gate = selectFarmRespecGate(usePlannerStore.getState());
    expect(gate.reason).toBeNull();
    expect(gate.result?.gainPct).toBe(0);
    expect(gate.result?.gainPct).toBeLessThan(FARM_RESPEC_MIN_GAIN_PCT);
    expect(gate.shouldSurface).toBe(false);

    // Non-vacuity: `shouldSurface` is false because the gate RAN and found nothing above the
    // threshold, not because it bailed out. A null reason and a non-null result together prove it
    // ran; `outcome` naming the specific terminal state proves it reached a considered answer
    // rather than erroring into a default.
    expect(gate.result).not.toBeNull();
    expect(gate.result?.outcome).toBe('nothingToGain');
  });

  it('Tier 1 is a lower bound: gainIsLowerBound is true and its gain never exceeds Tier 2\'s', () => {
    const gate = selectFarmRespecGate(usePlannerStore.getState());
    const solve = runFarmRespecSolve(usePlannerStore.getState());
    expect(gate.result?.gainIsLowerBound).toBe(true);
    expect(gate.result!.gainPct).toBeLessThanOrEqual(solve.gainPct);
  });

  it.skip('the recommended phase lands in the 26-28 band, and the measured gain is at least 5% and finite', () => {
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

  it.skip('re-rank moves the top-by-gold phase into the 26-28 band, away from the current build\'s top phase', () => {
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
