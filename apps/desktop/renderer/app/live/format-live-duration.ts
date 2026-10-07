import { sub, type Copy } from '../../lib/copy';

export function formatLiveDurationSeconds(seconds: number): string {
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const paddedSeconds = String(secs).padStart(2, '0');

  if (hours > 0) {
    return `${String(hours)}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`;
  }
  return `${String(minutes)}:${paddedSeconds}`;
}

type DurationUnits = Pick<Copy, 'liveDurationUnderMinute' | 'liveDurationMinutes' | 'liveDurationHoursMinutes'>;

/** Whole minutes, floored, so a shorter span never reads longer than a longer one. */
export function formatLiveDurationMinutes(seconds: number, units: DurationUnits): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  if (totalMinutes < 1) return units.liveDurationUnderMinute;
  if (totalMinutes < 60) return sub(units.liveDurationMinutes, { n: totalMinutes });
  return sub(units.liveDurationHoursMinutes, {
    h: Math.floor(totalMinutes / 60),
    mm: String(totalMinutes % 60).padStart(2, '0'),
  });
}

const MAX_COVERAGE_MINUTES = 10;

/** The rolling window is capped at 600s (10 real minutes) and starts shorter — floored, not
 *  rounded up, so the label never claims more coverage than the figures actually rest on. */
export function coverageMinutesLabel(coverageSeconds: number): number {
  return Math.min(MAX_COVERAGE_MINUTES, Math.max(1, Math.floor(coverageSeconds / 60)));
}
