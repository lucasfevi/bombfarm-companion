import { BCP47_BY_LOCALE, type AppLocale, type PvpDuelRow, type PvpHistoryResult } from '@bombfarm/contracts';

/** The signed points move of one duel, `+5` / `−10` in the locale's own digits and sign. */
export function formatPointsDelta(row: Pick<PvpDuelRow, 'pointsBefore' | 'pointsAfter'>, locale: AppLocale): string {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], { signDisplay: 'exceptZero' }).format(row.pointsAfter - row.pointsBefore);
}

/** The tier as the game prints it — a number — from the token the server names it by (`r2`),
 *  or the number the state carries beside it. A token of another shape prints as it came. */
export function tierNumberOf(tier: string, tierNumber: number | null = null): string {
  if (tierNumber !== null) return String(tierNumber);
  const match = /^r(\d+)$/i.exec(tier);
  return match?.[1] ?? tier;
}

/** Duels left today, from the standing when it carries the quota and otherwise from the latest
 *  duel's own report — a result always says what was left after it. `null` before either. */
export function duelsLeft(history: PvpHistoryResult): { readonly left: number; readonly max: number } | null {
  const standing = history.standing;
  if (standing !== null && standing.duelsUsed !== null && standing.duelsMax !== null) {
    return { left: Math.max(0, standing.duelsMax - standing.duelsUsed), max: standing.duelsMax };
  }
  const latest = history.rows[0];
  return latest === undefined ? null : { left: latest.duelsLeft, max: latest.duelsMax };
}

export type PvpResultFilter = 'all' | 'won' | 'lost';

/** The opponent filter's `all` token: an empty name, which no opponent carries. */
export const ALL_OPPONENTS = '';

/** Every opponent fought, most fought first and then by name, for the filter's options. */
export function opponentNames(rows: readonly PvpDuelRow[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.defender.name, (counts.get(row.defender.name) ?? 0) + 1);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([name]) => name);
}

export function filterDuels(rows: readonly PvpDuelRow[], opponent: string, result: PvpResultFilter): readonly PvpDuelRow[] {
  return rows.filter(
    (row) =>
      (opponent === ALL_OPPONENTS || row.defender.name === opponent) &&
      (result === 'all' || (result === 'won') === row.won),
  );
}

export interface HeadToHead {
  readonly duels: number;
  readonly won: number;
  readonly lost: number;
  readonly yourScore: number;
  readonly theirScore: number;
}

/** The record against one opponent over every duel held against them, whatever the result
 *  filter shows: the line reads as the rivalry, not as the rows under it. */
export function headToHead(rows: readonly PvpDuelRow[], opponent: string): HeadToHead {
  const against = rows.filter((row) => row.defender.name === opponent);
  return {
    duels: against.length,
    won: against.filter((row) => row.won).length,
    lost: against.filter((row) => !row.won).length,
    yourScore: against.reduce((sum, row) => sum + row.attacker.score, 0),
    theirScore: against.reduce((sum, row) => sum + row.defender.score, 0),
  };
}
