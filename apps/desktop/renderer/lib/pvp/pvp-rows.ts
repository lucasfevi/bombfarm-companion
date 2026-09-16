import { BCP47_BY_LOCALE, type AppLocale, type PvpDuelRow, type PvpHistoryResult } from '@bombfarm/contracts';

/** The signed points move of one duel, `+5` / `−10` in the locale's own digits and sign. */
export function formatPointsDelta(row: Pick<PvpDuelRow, 'pointsBefore' | 'pointsAfter'>, locale: AppLocale): string {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], { signDisplay: 'exceptZero' }).format(row.pointsAfter - row.pointsBefore);
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
