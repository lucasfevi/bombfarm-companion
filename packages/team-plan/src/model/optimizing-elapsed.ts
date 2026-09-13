/** Formats an elapsed run duration for the optimizing modal — seconds under a minute, m:ss past. */
export function formatElapsed(elapsedMs: number): string {
  const totalSec = Math.floor(elapsedMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min <= 0) return `${sec}s`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}
