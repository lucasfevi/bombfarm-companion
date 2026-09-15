import { pickBestFarmRow } from '@bombfarm/farm/model/farm-ranking-view';
import { selectFarmRankingRows, type FarmRankingResult, type PlannerStore } from '@/shared/stores';

type FarmRateRow = FarmRankingResult['rows'][number];

export type FarmSentenceFragment =
  | { kind: 'ahead' | 'behind'; count: number }
  | { kind: 'clearFaster' | 'clearSlower'; deltaSecs: number }
  | { kind: 'dropsKeepAdd'; keep: number[]; add: number[] }
  | { kind: 'dropsAdd'; add: number[] }
  | { kind: 'dropsKeepLose'; keep: number[]; lose: number[] }
  | { kind: 'dropsLose'; lose: number[] }
  | { kind: 'dropsSwap'; lose: number[]; add: number[] }
  | { kind: 'oneShotGained' | 'oneShotLost' };

export type FarmCardPillTone = 'up' | 'down' | 'neutral';

/** What stands between the account and a locked phase: the first gate it has not cleared. */
export type FarmOutlookBlock = { gate: number; gateInfeasible: boolean } | null;

export type FarmOutlookTile = {
  row: FarmRateRow;
  /** Gold/hr against the phase the tile is a step from. */
  against: 'best' | 'current';
  pct: number;
  tone: FarmCardPillTone;
  block: FarmOutlookBlock;
};

export type FarmNextItemLevel = { kind: 'tile'; tile: FarmOutlookTile } | { kind: 'none' };
export type FarmNextDifficulty = { kind: 'tile'; tile: FarmOutlookTile } | { kind: 'top'; ato: number };

export type FarmCardView = {
  currentRow: FarmRateRow | null;
  bestRow: FarmRateRow | null;
  pushTargetRow: FarmRateRow | null;
  pill: { tone: FarmCardPillTone; pct: number | null };
  barPercent: { current: number; best: number };
  sentence: FarmSentenceFragment[];
  nextItemLevel: FarmNextItemLevel | null;
  nextDifficulty: FarmNextDifficulty | null;
};

const NO_TILES: FarmCardView = {
  currentRow: null,
  bestRow: null,
  pushTargetRow: null,
  pill: { tone: 'neutral', pct: null },
  barPercent: { current: 0, best: 0 },
  sentence: [],
  nextItemLevel: null,
  nextDifficulty: null,
};

function topBand(row: FarmRateRow): number {
  return row.itemLevels.length > 0 ? Math.max(...row.itemLevels) : 0;
}

function toneOf(pct: number): FarmCardPillTone {
  return pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral';
}

function blockFor(rows: readonly FarmRateRow[], target: FarmRateRow): FarmOutlookBlock {
  if (!target.locked) return null;
  const gate = rows.find((row) => row.gate && row.locked && row.phase < target.phase);
  return gate ? { gate: gate.phase, gateInfeasible: gate.infeasible } : null;
}

function outlookTile(
  rows: readonly FarmRateRow[],
  row: FarmRateRow,
  against: 'best' | 'current',
  reference: FarmRateRow,
): FarmOutlookTile {
  const pct = ((row.goldPerHour - reference.goldPerHour) / reference.goldPerHour) * 100;
  return { row, against, pct, tone: toneOf(pct), block: blockFor(rows, row) };
}

export function nextItemLevelFrom(rows: readonly FarmRateRow[], best: FarmRateRow): FarmNextItemLevel {
  const bestTop = topBand(best);
  const row = rows.find((candidate) => topBand(candidate) > bestTop);
  return row ? { kind: 'tile', tile: outlookTile(rows, row, 'best', best) } : { kind: 'none' };
}

export function nextDifficultyFrom(rows: readonly FarmRateRow[], current: FarmRateRow): FarmNextDifficulty {
  const row = rows.find((candidate) => candidate.ato === current.ato + 1);
  return row
    ? { kind: 'tile', tile: outlookTile(rows, row, 'current', current) }
    : { kind: 'top', ato: current.ato };
}

function dropChange(current: FarmRateRow, best: FarmRateRow): FarmSentenceFragment | null {
  const before = new Set(current.itemLevels);
  const after = new Set(best.itemLevels);
  const keep = current.itemLevels.filter((level) => after.has(level));
  const add = best.itemLevels.filter((level) => !before.has(level));
  const lose = current.itemLevels.filter((level) => !after.has(level));
  if (add.length === 0 && lose.length === 0) return null;
  if (add.length > 0 && lose.length > 0) return { kind: 'dropsSwap', lose, add };
  if (add.length > 0) return keep.length > 0 ? { kind: 'dropsKeepAdd', keep, add } : { kind: 'dropsAdd', add };
  return keep.length > 0 ? { kind: 'dropsKeepLose', keep, lose } : { kind: 'dropsLose', lose };
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

  const drops = dropChange(current, best);
  if (drops) fragments.push(drops);

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
  const byPhase = [...rows].sort((left, right) => left.phase - right.phase);
  const nextItemLevel = nextItemLevelFrom(byPhase, bestRow);
  const nextDifficulty = nextDifficultyFrom(byPhase, currentRow);
  if (bestRow.phase === currentRow.phase) {
    return {
      currentRow,
      bestRow,
      pushTargetRow,
      pill: { tone: 'neutral', pct: null },
      barPercent: { current: 100, best: 100 },
      sentence: [],
      nextItemLevel,
      nextDifficulty,
    };
  }
  const pct = ((bestRow.goldPerHour - currentRow.goldPerHour) / currentRow.goldPerHour) * 100;
  const peak = Math.max(currentRow.goldPerHour, bestRow.goldPerHour);
  return {
    currentRow,
    bestRow,
    pushTargetRow,
    pill: { tone: toneOf(pct), pct },
    barPercent: {
      current: (currentRow.goldPerHour / peak) * 100,
      best: (bestRow.goldPerHour / peak) * 100,
    },
    sentence: sentenceFragments(currentRow, bestRow),
    nextItemLevel,
    nextDifficulty,
  };
}

let cache: { rows: readonly FarmRateRow[]; phase: number | null; view: FarmCardView } | null = null;

export function selectFarmCardRows(state: PlannerStore): FarmCardView {
  const { rows } = selectFarmRankingRows(state);
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
