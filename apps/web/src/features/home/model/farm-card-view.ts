import { pickBestFarmRow } from '@bombfarm/farm/model/farm-ranking-view';
import { selectFarmBoardRows, type FarmRankingResult, type PlannerStore } from '@/shared/stores';

type FarmRateRow = FarmRankingResult['rows'][number];

export type FarmSentenceFragment =
  | { kind: 'ahead' | 'behind'; count: number }
  | { kind: 'clearFaster' | 'clearSlower'; deltaSecs: number }
  | { kind: 'itemLevelUp' | 'itemLevelDown'; delta: number }
  | { kind: 'oneShotGained' | 'oneShotLost' };

export type FarmCardPillTone = 'up' | 'down' | 'neutral';

export type FarmCardView = {
  currentRow: FarmRateRow | null;
  bestRow: FarmRateRow | null;
  pushTargetRow: FarmRateRow | null;
  pill: { tone: FarmCardPillTone; pct: number | null };
  barPercent: { current: number; best: number };
  sentence: FarmSentenceFragment[];
};

const NO_TILES: FarmCardView = {
  currentRow: null,
  bestRow: null,
  pushTargetRow: null,
  pill: { tone: 'neutral', pct: null },
  barPercent: { current: 0, best: 0 },
  sentence: [],
};

function lowestBand(row: FarmRateRow): number {
  return row.itemLevels.length > 0 ? Math.min(...row.itemLevels) : 0;
}

function sentenceFragments(current: FarmRateRow, best: FarmRateRow): FarmSentenceFragment[] {
  const fragments: FarmSentenceFragment[] = [];
  const distance = best.phase - current.phase;
  fragments.push({ kind: distance > 0 ? 'ahead' : 'behind', count: Math.abs(distance) });

  const bothClear = Number.isFinite(current.clearSecs) && Number.isFinite(best.clearSecs);
  if (bothClear && best.clearSecs !== current.clearSecs) {
    const deltaSecs = Math.abs(best.clearSecs - current.clearSecs);
    fragments.push({ kind: best.clearSecs < current.clearSecs ? 'clearFaster' : 'clearSlower', deltaSecs });
  }

  const bandDelta = lowestBand(best) - lowestBand(current);
  if (bandDelta !== 0) {
    fragments.push({ kind: bandDelta > 0 ? 'itemLevelUp' : 'itemLevelDown', delta: Math.abs(bandDelta) });
  }

  if (best.oneShot && !current.oneShot) fragments.push({ kind: 'oneShotGained' });
  if (!best.oneShot && current.oneShot) fragments.push({ kind: 'oneShotLost' });
  return fragments;
}

export function farmCardViewFrom(rows: readonly FarmRateRow[], phase: number | null): FarmCardView {
  const currentRow = rows.find((row) => row.phase === phase) ?? null;
  const bestRow = pickBestFarmRow(rows.filter((row) => !row.locked));
  const pushCandidate = pickBestFarmRow(rows.filter((row) => row.locked));
  const pushTargetRow =
    pushCandidate && bestRow && pushCandidate.goldPerHour > bestRow.goldPerHour ? pushCandidate : null;

  if (currentRow == null || bestRow == null) return NO_TILES;
  if (bestRow.phase === currentRow.phase) {
    return {
      currentRow,
      bestRow,
      pushTargetRow,
      pill: { tone: 'neutral', pct: null },
      barPercent: { current: 100, best: 100 },
      sentence: [],
    };
  }
  const pct = ((bestRow.goldPerHour - currentRow.goldPerHour) / currentRow.goldPerHour) * 100;
  const peak = Math.max(currentRow.goldPerHour, bestRow.goldPerHour);
  return {
    currentRow,
    bestRow,
    pushTargetRow,
    pill: { tone: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral', pct },
    barPercent: {
      current: (currentRow.goldPerHour / peak) * 100,
      best: (bestRow.goldPerHour / peak) * 100,
    },
    sentence: sentenceFragments(currentRow, bestRow),
  };
}

let cache: { rows: readonly FarmRateRow[]; phase: number | null; view: FarmCardView } | null = null;

export function selectFarmCardRows(state: PlannerStore): FarmCardView {
  const { rows } = selectFarmBoardRows(state);
  if (cache && Object.is(cache.rows, rows) && Object.is(cache.phase, state.phase)) {
    return cache.view;
  }
  const view = farmCardViewFrom(rows, state.phase);
  cache = { rows, phase: state.phase, view };
  return view;
}

export function resetFarmCardViewCacheForTests(): void {
  cache = null;
}
