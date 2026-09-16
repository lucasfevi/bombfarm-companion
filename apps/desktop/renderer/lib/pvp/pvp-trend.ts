import type { PvpDuelRow, PvpStateSnapshot } from '@bombfarm/contracts';
import type { SparklineMarkTone } from '@bombfarm/ui';

/** What a win was observed to pay before any won row is on record. */
export const DEFAULT_POINTS_PER_WIN = 5;

/** How many of the newest duels the points trend draws. */
export const TREND_WINDOW = 12;

type PointsMove = Pick<PvpDuelRow, 'won' | 'pointsBefore' | 'pointsAfter'>;

/** The points a win pays, read off the latest won row; the observed default before one exists. */
export function pointsPerWin(rows: readonly PointsMove[]): number {
  const latestWin = rows.find((row) => row.won);
  const step = latestWin === undefined ? 0 : latestWin.pointsAfter - latestWin.pointsBefore;
  return step > 0 ? step : DEFAULT_POINTS_PER_WIN;
}

export interface TierEta {
  readonly wins: number;
  /** Days at today's full quota; `null` when the quota is not known. */
  readonly days: number | null;
}

/** Wins between the points held and the next tier's threshold, and the days those wins take at
 *  the daily quota — `null` at the top tier, which has no threshold ahead of it. */
export function winsToNextTier(
  standing: Pick<PvpStateSnapshot, 'points' | 'nextTierAt' | 'duelsMax'>,
  step: number,
): TierEta | null {
  if (standing.nextTierAt === null) return null;
  const wins = Math.max(0, Math.ceil((standing.nextTierAt - standing.points) / step));
  const days = standing.duelsMax === null || standing.duelsMax <= 0 ? null : Math.ceil(wins / standing.duelsMax);
  return { wins, days };
}

/** The meter's fill, 0–100, over a track running from zero to the next tier's threshold. */
export function tierMeterPercent(standing: Pick<PvpStateSnapshot, 'points' | 'nextTierAt'>): number {
  if (standing.nextTierAt === null || standing.nextTierAt <= 0) return 100;
  return Math.min(100, Math.max(0, (100 * standing.points) / standing.nextTierAt));
}

/** The tier number after the one printed, when the printed one is a number. */
export function tierAfter(tierLabel: string): string | null {
  const tier = Number(tierLabel);
  return Number.isInteger(tier) ? String(tier + 1) : null;
}

/** The newest `size` rows, still newest first. */
export function trendWindow<T>(rows: readonly T[], size: number = TREND_WINDOW): readonly T[] {
  return rows.slice(0, size);
}

/** Points after each duel, oldest first, from rows served newest first. */
export function pointsSeries(rows: readonly Pick<PvpDuelRow, 'pointsAfter'>[]): readonly number[] {
  return rows.map((row) => row.pointsAfter).reverse();
}

/** The result of each duel as the tone of its dot on the trend, oldest first like `pointsSeries`. */
export function resultMarks(rows: readonly Pick<PvpDuelRow, 'won'>[]): readonly SparklineMarkTone[] {
  return rows.map((row): SparklineMarkTone => (row.won ? 'up' : 'down')).reverse();
}

/** Wins as a fraction of the rows given; `0` for none. */
export function winRate(rows: readonly Pick<PvpDuelRow, 'won'>[]): number {
  if (rows.length === 0) return 0;
  return rows.filter((row) => row.won).length / rows.length;
}

export interface Streak {
  readonly result: 'won' | 'lost';
  readonly length: number;
}

/** The unbroken run of one result from the newest row back; `null` for no rows. */
export function streak(rows: readonly Pick<PvpDuelRow, 'won'>[]): Streak | null {
  const newest = rows[0];
  if (newest === undefined) return null;
  let length = 0;
  for (const row of rows) {
    if (row.won !== newest.won) break;
    length += 1;
  }
  return { result: newest.won ? 'won' : 'lost', length };
}
