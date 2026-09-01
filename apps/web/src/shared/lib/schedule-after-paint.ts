/**
 * Re-exported so this app keeps one import path for it while the implementation has a single
 * owner — the farm board is what schedules a compute off the paint, and the desktop app runs the
 * same board.
 */
export { scheduleAfterPaint } from '@bombfarm/farm';
