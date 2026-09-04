export function formatDurationShort(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const minutes = Math.floor((secs % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.round(secs)}s`;
}

export { formatClearTime } from '@bombfarm/hero/model';

/** Gate key rarity index by difficulty (ato 1→Incomum … 5→Mítico). */
export const GATE_KEY_RARITY_INDEX = [1, 2, 3, 4, 5] as const;
