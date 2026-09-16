import { BCP47_BY_LOCALE, type AppLocale, type PvpDuelRow, type PvpHistoryResult } from '@bombfarm/contracts';

/** The signed points move of one duel, `+5` / `−10` in the locale's own digits and sign. */
export function formatPointsDelta(row: Pick<PvpDuelRow, 'pointsBefore' | 'pointsAfter'>, locale: AppLocale): string {
  return new Intl.NumberFormat(BCP47_BY_LOCALE[locale], { signDisplay: 'exceptZero' }).format(row.pointsAfter - row.pointsBefore);
}

/** The quota as the most recent duel reported it — the one row that knows, since the tap sees
 *  no state read of its own. `null` before any duel. */
export function latestQuota(history: PvpHistoryResult): { readonly left: number; readonly max: number } | null {
  const latest = history.rows[0];
  return latest === undefined ? null : { left: latest.duelsLeft, max: latest.duelsMax };
}
