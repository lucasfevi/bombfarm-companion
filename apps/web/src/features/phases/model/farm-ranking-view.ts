/**
 * The board's sort/filter/column semantics — PURE, no React, no math. Every value here is
 * compared, sliced or labelled from `FarmRateRow` fields `@bombfarm/domain` already produced. ZERO rate
 * arithmetic: no mitigation factor, no HTK, no Sorte, no gold multiplier, no props/s, no
 * per-prop one-shot derivation — guarded by `farm-ranking-guards.test.ts`.
 */
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import type { Strings } from '@/shared/i18n';

export type FarmSortKey =
  | 'mitigationPct'
  | 'goldPerHour'
  | 'chestsPerHour'
  | 'keysPerHour'
  | 'gemsPerHour'
  | 'timePiecesPerHour'
  | 'xpPerHour'
  | 'clearSecs';

export type FarmSortDir = 'asc' | 'desc';

/** Keys of `Strings` whose value is a plain string — narrows `t[headerKey]` to `string`. */
type StringKeyOf<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];

export type FarmColumnDef = {
  /** Stable, greppable id — also the `data-testid` suffix. */
  id: string;
  /** `Strings` key for the column header text (`t.*`, `farmRanking*` prefix). */
  headerKey: StringKeyOf<Strings>;
  align: 'left' | 'right';
  numeric: boolean;
  sortKey: FarmSortKey | null;
};

/**
 * Every board column. Transcribed from the design's column list, not derived from `FarmRateRow` —
 * the test asserting this set compares it against that enumeration, not against
 * itself.
 */
export const FARM_COLUMNS: readonly FarmColumnDef[] = [
  { id: 'phase', headerKey: 'farmRankingColPhase', align: 'left', numeric: false, sortKey: null },
  {
    id: 'mitigation',
    headerKey: 'farmRankingColMitigation',
    align: 'right',
    numeric: true,
    sortKey: 'mitigationPct',
  },
  { id: 'gold', headerKey: 'farmRankingColGold', align: 'right', numeric: true, sortKey: 'goldPerHour' },
  {
    id: 'chests',
    headerKey: 'farmRankingColChests',
    align: 'right',
    numeric: true,
    sortKey: 'chestsPerHour',
  },
  { id: 'keys', headerKey: 'farmRankingColKeys', align: 'right', numeric: true, sortKey: 'keysPerHour' },
  { id: 'gems', headerKey: 'farmRankingColGems', align: 'right', numeric: true, sortKey: 'gemsPerHour' },
  {
    id: 'timePieces',
    headerKey: 'farmRankingColTimePieces',
    align: 'right',
    numeric: true,
    sortKey: 'timePiecesPerHour',
  },
  { id: 'xp', headerKey: 'farmRankingColXp', align: 'right', numeric: true, sortKey: 'xpPerHour' },
  {
    id: 'itemLevel',
    headerKey: 'farmRankingColItemLevel',
    align: 'right',
    numeric: false,
    sortKey: null,
  },
  {
    id: 'clearTime',
    headerKey: 'farmRankingColClearTime',
    align: 'right',
    numeric: true,
    sortKey: 'clearSecs',
  },
  { id: 'oneShot', headerKey: 'farmRankingColOneShot', align: 'left', numeric: false, sortKey: null },
  { id: 'jaula', headerKey: 'farmRankingColJaula', align: 'left', numeric: false, sortKey: null },
  {
    id: 'infeasible',
    headerKey: 'farmRankingColInfeasible',
    align: 'left',
    numeric: false,
    sortKey: null,
  },
] as const;

export const DEFAULT_SORT: { key: FarmSortKey; direction: FarmSortDir } = {
  key: 'goldPerHour',
  direction: 'desc',
};

const FINITE_MAX = Number.MAX_SAFE_INTEGER;

/** `Infinity` sorts to the "worst" end regardless of direction (never the top of any sort). */
function sortableValue(row: FarmRateRow, key: FarmSortKey, direction: FarmSortDir): number {
  const raw = row[key];
  if (!Number.isFinite(raw)) {
    return direction === 'desc' ? -FINITE_MAX : FINITE_MAX;
  }
  return raw;
}

/**
 * Stable sort by `key`/`direction`; ties break by ascending `phase` so ordering is deterministic
 * across renders. Infeasible rows are sorted by their own (degenerate) rate, never
 * pinned or reordered specially.
 */
export function sortFarmRows(
  rows: readonly FarmRateRow[],
  key: FarmSortKey,
  direction: FarmSortDir,
): FarmRateRow[] {
  return [...rows].sort((left, right) => {
    const leftValue = sortableValue(left, key, direction);
    const rightValue = sortableValue(right, key, direction);
    if (leftValue !== rightValue) {
      return direction === 'asc' ? leftValue - rightValue : rightValue - leftValue;
    }
    return left.phase - right.phase;
  });
}

export type GateFilter = 'all' | 'gate' | 'non-gate';

export type FarmFilters = {
  unlockedOnly: boolean;
  ato: number | null;
  gate: GateFilter;
  feasibleOnly: boolean;
};

export function defaultFarmFilters(): FarmFilters {
  return { unlockedOnly: true, ato: null, gate: 'all', feasibleOnly: false };
}

/**
 * Reads `row.locked` for the unlocked-only filter — does NOT take `maxPhase` and does NOT
 * compute lockedness (that is `@bombfarm/domain`'s, via `FarmRateOptions`). When `maxPhase` is `null`, every row
 * is `locked: false`, so `unlockedOnly` is a no-op and no row is excluded.
 */
export function applyFarmFilters(
  rows: readonly FarmRateRow[],
  filters: FarmFilters,
): FarmRateRow[] {
  return rows.filter((row) => {
    if (filters.unlockedOnly && row.locked) return false;
    if (filters.ato != null && row.ato !== filters.ato) return false;
    if (filters.gate === 'gate' && !row.gate) return false;
    if (filters.gate === 'non-gate' && row.gate) return false;
    if (filters.feasibleOnly && row.infeasible) return false;
    return true;
  });
}
