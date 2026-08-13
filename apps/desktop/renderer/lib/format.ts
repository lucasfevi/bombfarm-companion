/**
 * The one number/date formatter for the renderer (design.md §6, TD-12). The spec's edge case
 * names `page.tsx`'s former inline `formatAgeLabel` as a placeholder for exactly this and says
 * it SHALL NOT be duplicated — every numeric/date display in the renderer goes through here.
 */

/** Short seconds/minutes age label for `StatusChip.ageLabel` — same shape as the deleted inline `formatAgeLabel`. */
export function formatAge(staleAgeMs: number): string {
  const seconds = Math.max(0, Math.round(staleAgeMs / 1000));
  return seconds < 60 ? `${seconds.toFixed(0)}s` : `${Math.round(seconds / 60).toFixed(0)}m`;
}

/**
 * Human-relative age of an ISO-8601 `capturedAt` timestamp (MPV-04 — restored data is stamped
 * with its capture time, never presented as current). `now` defaults to `Date.now()` and is
 * otherwise injectable for tests.
 */
export function formatCapturedAt(capturedAt: string, now: number = Date.now()): string {
  const capturedMs = Date.parse(capturedAt);
  if (!Number.isFinite(capturedMs)) return capturedAt;
  const ageMs = Math.max(0, now - capturedMs);
  const seconds = Math.round(ageMs / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes.toFixed(0)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours.toFixed(0)}h ago`;
  const days = Math.round(hours / 24);
  return `${days.toFixed(0)}d ago`;
}

/** Signed percentage gain, one decimal place — used for next-point ranking rows. */
export function formatGainPct(gainPct: number): string {
  return `${gainPct >= 0 ? '+' : ''}${gainPct.toFixed(1)}%`;
}

/** Whole-number DPS, thousands-grouped. */
export function formatDps(dps: number): string {
  return Math.round(dps).toLocaleString('en-US');
}

/** Thousands-grouped integer count (e.g. gear/warning counts). */
export function formatCount(count: number): string {
  return Math.round(count).toLocaleString('en-US');
}
