import type { AccountView } from '@bombfarm/contracts';
import { passActive } from '@bombfarm/domain/import-save';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function readVipUntil(view: AccountView | null): number | null {
  const value = view?.payload.account?.vip_until;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** `12d 4h 30m`; under a day the days part is dropped, under an hour only minutes remain, and the
 *  last minute reads `<1m`. `null` when the Pass is not active — nothing is drawn for it. */
export function formatPassRemaining(vipUntil: number | null, nowMs: number): string | null {
  if (!passActive(vipUntil, nowMs) || vipUntil === null) return null;
  const remainingMs = vipUntil * 1000 - nowMs;
  const days = Math.floor(remainingMs / DAY_MS);
  const hours = Math.floor((remainingMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((remainingMs % HOUR_MS) / MINUTE_MS);
  if (days > 0) return `${String(days)}d ${String(hours)}h ${String(minutes)}m`;
  if (hours > 0) return `${String(hours)}h ${String(minutes)}m`;
  return minutes > 0 ? `${String(minutes)}m` : '<1m';
}
