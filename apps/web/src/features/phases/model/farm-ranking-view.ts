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

/** `levels` is `@bombfarm/domain`'s ascending band list; empty means nothing is guaranteed. */
function lowestItemLevelAtLeast(levels: readonly number[], floor: number): boolean {
  return levels.length > 0 && Math.min(...levels) >= floor;
}

export type GateFilter = 'all' | 'gate' | 'non-gate';

export type FarmFilters = {
  unlockedOnly: boolean;
  ato: number | null;
  gate: GateFilter;
  /** Keep phases whose LOWEST drop band is at least this level. `null` => no item-level floor. */
  minItemLevel: number | null;
};

export function defaultFarmFilters(): FarmFilters {
  return { unlockedOnly: true, ato: null, gate: 'all', minItemLevel: null };
}

/**
 * Reads `row.locked` for the unlocked-only filter — does NOT take `maxPhase` and does NOT
 * compute lockedness (that is `@bombfarm/domain`'s, via `FarmRateOptions`). When `maxPhase` is `null`, every row
 * is `locked: false`, so `unlockedOnly` is a no-op and no row is excluded.
 *
 * `minItemLevel` reads `row.itemLevels`, the overlapping drop bands `@bombfarm/domain` already resolved for
 * the phase. A row qualifies only when its LOWEST band is at or above the floor: bands overlap by
 * ten phases, and inside an overlap the lower tier still rolls, so a phase that can hand back a
 * level-10 item is not a level-20 farm. A row with no known bands guarantees nothing and is
 * excluded.
 */
export function applyFarmFilters(
  rows: readonly FarmRateRow[],
  filters: FarmFilters,
): FarmRateRow[] {
  const minItemLevel = filters.minItemLevel;
  return rows.filter((row) => {
    if (filters.unlockedOnly && row.locked) return false;
    if (filters.ato != null && row.ato !== filters.ato) return false;
    if (filters.gate === 'gate' && !row.gate) return false;
    if (filters.gate === 'non-gate' && row.gate) return false;
    if (minItemLevel != null && !lowestItemLevelAtLeast(row.itemLevels, minItemLevel)) return false;
    return true;
  });
}

/**
 * The row with the highest `goldPerHour`, skipping `infeasible` rows; ties break by the lower
 * `phase` for determinism. `null` for an empty list (or one with no feasible row). Callers should
 * feed this the already filtered/sorted `visibleRows`, never the raw row set — an independent
 * max-search here on purpose, so a later change to `DEFAULT_SORT` cannot silently change which
 * row this picks.
 */
export function pickBestFarmRow(rows: readonly FarmRateRow[]): FarmRateRow | null {
  let best: FarmRateRow | null = null;
  for (const row of rows) {
    if (row.infeasible) continue;
    if (
      best === null ||
      row.goldPerHour > best.goldPerHour ||
      (row.goldPerHour === best.goldPerHour && row.phase < best.phase)
    ) {
      best = row;
    }
  }
  return best;
}

/**
 * Under this, the field is contending too little for a banner to earn its place. Every roster
 * with more heroes than field slots contends a little; a notice reading "0.1% of the time" is
 * noise that teaches people to ignore the notice that matters.
 */
export const CONTENTION_NOTICE_MIN_PCT = 5;

export type ContentionNotice = {
  /** Share of wall clock with a rested hero benched behind a full field — PERCENT. */
  pct: number;
};

/**
 * The field-contention notice for the row the player is looking at, or `null` when there is
 * nothing worth saying.
 *
 * PER-ROW, NEVER AGGREGATED: `fieldContentionPct` is phase-dependent (the House allocation it
 * reads is), so this takes the one row being shown rather than reducing over the table. The board
 * feeds it the current phase's row, falling back to the best one before a phase is chosen.
 *
 * FREQUENCY ONLY, never a throughput cost. What the wait COSTS depends on which hero takes a
 * freed slot, which the game does not fix; the frequency does not. The copy says as much rather
 * than quoting a magnitude the model cannot stand behind — and it does not promise that benching
 * heroes helps, because it usually does not: on a 14-hero roster at 9 slots, dropping the five
 * weakest takes contention 26.1% -> 0% and gold/hr 19.97M -> 17.17M.
 */
export function pickContentionNotice(row: FarmRateRow | null | undefined): ContentionNotice | null {
  if (!row || row.infeasible) return null;
  if (!(row.fieldContentionPct >= CONTENTION_NOTICE_MIN_PCT)) return null;
  return { pct: row.fieldContentionPct };
}
