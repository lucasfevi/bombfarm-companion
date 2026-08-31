/**
 * The farm board's three single-entry memos, and the compute counters the tests drive, as ONE
 * instance a host owns rather than module state a whole process shares.
 *
 * Why a factory: two apps now run this compute, and a test that resets "the" cache would
 * otherwise reset the other app's too. An instance also lets a suite take a fresh memo instead
 * of relying on a reset having run — a reset that is silently skipped reads as a passing cache
 * hit, which is the failure mode module-level caches keep producing.
 *
 * Each memo returns the SAME object identity on a cache hit. That is load-bearing wherever a
 * host subscribes a component to one of these results directly: a fresh-but-equal object on
 * every call turns a store subscription into an unbounded re-render loop on a 600-row board.
 */
import type { SquadFarmFacts } from '@bombfarm/domain/farm-rate';
import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import type { FarmInputs } from './farm-inputs';
import {
  computeFarmProposedRows,
  computeFarmRanking,
  computeFarmRespecGate,
  farmDepsEqual,
  readFarmDepTuple,
  readFarmRespecDepTuple,
  runFarmRespecSolve,
  type FarmRankingResult,
  type FarmRespecGate,
} from './farm-compute';

export type FarmRankingMemo = {
  /** The board's ranking rows, memoized on {@link readFarmDepTuple}. */
  rows(inputs: FarmInputs): FarmRankingResult;
  /** Tier 1 — the always-on respec gate, memoized on {@link readFarmRespecDepTuple}. */
  gate(inputs: FarmInputs): FarmRespecGate;
  /** The rows for an already-solved proposed squad, memoized on the squad plus the only two
   *  other inputs the table reads (`maxPhase`, `farmReturnBonus`). */
  boardRows(inputs: FarmInputs, proposedSquad: SquadFarmFacts): FarmRankingResult;
  /** Tier 2 — counted, never memoized. Every call solves again. */
  solve(inputs: FarmInputs): FarmRespecResult;
  /** Drops all three caches, leaving every counter alone. */
  reset(): void;
  rowsComputeCount(): number;
  /** Zeroes the rows counter AND drops all three caches — a counter reset that left a warm
   *  cache behind would report zero computes for a board that never recomputed. */
  resetRowsComputeCount(): void;
  gateComputeCount(): number;
  resetGateComputeCount(): void;
  boardRowsComputeCount(): number;
  resetBoardRowsComputeCount(): void;
  solveCount(): number;
  resetSolveCount(): void;
};

type Entry<T> = { deps: readonly unknown[]; value: T };

export function createFarmRankingMemo(): FarmRankingMemo {
  let rowsCache: Entry<FarmRankingResult> | null = null;
  let gateCache: Entry<FarmRespecGate> | null = null;
  let boardRowsCache: Entry<FarmRankingResult> | null = null;

  let rowsComputes = 0;
  let gateComputes = 0;
  let boardRowsComputes = 0;
  let solves = 0;

  function reset(): void {
    rowsCache = null;
    gateCache = null;
    boardRowsCache = null;
  }

  return {
    rows(inputs) {
      const deps = readFarmDepTuple(inputs);
      if (rowsCache && farmDepsEqual(rowsCache.deps, deps)) {
        return rowsCache.value;
      }
      rowsComputes += 1;
      const value = computeFarmRanking(inputs);
      rowsCache = { deps, value };
      return value;
    },

    gate(inputs) {
      const deps = readFarmRespecDepTuple(inputs);
      if (gateCache && farmDepsEqual(gateCache.deps, deps)) {
        return gateCache.value;
      }
      gateComputes += 1;
      const value = computeFarmRespecGate(inputs);
      gateCache = { deps, value };
      return value;
    },

    boardRows(inputs, proposedSquad) {
      const deps = [proposedSquad, inputs.maxPhase, inputs.farmReturnBonus] as const;
      if (boardRowsCache && farmDepsEqual(boardRowsCache.deps, deps)) {
        return boardRowsCache.value;
      }
      boardRowsComputes += 1;
      const value = computeFarmProposedRows(proposedSquad, inputs);
      boardRowsCache = { deps, value };
      return value;
    },

    solve(inputs) {
      solves += 1;
      return runFarmRespecSolve(inputs);
    },

    reset,

    rowsComputeCount: () => rowsComputes,
    resetRowsComputeCount() {
      rowsComputes = 0;
      reset();
    },

    gateComputeCount: () => gateComputes,
    resetGateComputeCount() {
      gateComputes = 0;
      gateCache = null;
    },

    boardRowsComputeCount: () => boardRowsComputes,
    resetBoardRowsComputeCount() {
      boardRowsComputes = 0;
      boardRowsCache = null;
    },

    solveCount: () => solves,
    resetSolveCount() {
      solves = 0;
    },
  };
}
