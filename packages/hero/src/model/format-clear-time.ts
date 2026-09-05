export function formatClearTime(secs: number | null): string {
  if (secs == null || !Number.isFinite(secs)) return '—';
  if (secs < 60) return `${Math.round(secs)}s`;
  const minutes = Math.floor(secs / 60);
  const seconds = Math.round(secs % 60);
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}
