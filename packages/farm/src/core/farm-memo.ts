/**
 * The farm board's single-entry memo, and the compute counter the tests drive, as ONE instance a
 * host owns rather than module state a whole process shares.
 *
 * Why a factory: two apps now run this compute, and a test that resets "the" cache would
 * otherwise reset the other app's too. An instance also lets a suite take a fresh memo instead
 * of relying on a reset having run — a reset that is silently skipped reads as a passing cache
 * hit, which is the failure mode module-level caches keep producing.
 *
 * The memo returns the SAME object identity on a cache hit. That is load-bearing wherever a
 * host subscribes a component to the result directly: a fresh-but-equal object on every call
 * turns a store subscription into an unbounded re-render loop on a 600-row board.
 */
import type { FarmInputs } from './farm-inputs';
import {
  computeFarmRanking,
  farmDepsEqual,
  readFarmDepTuple,
  type FarmRankingResult,
} from './farm-compute';

export type FarmRankingMemo = {
  /** The board's ranking rows, memoized on {@link readFarmDepTuple}. */
  rows(inputs: FarmInputs): FarmRankingResult;
  /** Drops the cache, leaving the counter alone. */
  reset(): void;
  rowsComputeCount(): number;
  /** Zeroes the rows counter AND drops the cache — a counter reset that left a warm cache
   *  behind would report zero computes for a board that never recomputed. */
  resetRowsComputeCount(): void;
};

type Entry<T> = { deps: readonly unknown[]; value: T };

export function createFarmRankingMemo(): FarmRankingMemo {
  let rowsCache: Entry<FarmRankingResult> | null = null;

  let rowsComputes = 0;

  function reset(): void {
    rowsCache = null;
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

    reset,

    rowsComputeCount: () => rowsComputes,
    resetRowsComputeCount() {
      rowsComputes = 0;
      reset();
    },
  };
}
