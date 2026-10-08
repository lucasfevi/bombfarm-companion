import { describe, expect, it } from 'vitest';
import type { AccountView } from '@bombfarm/contracts';
import { formatPassRemaining, readVipUntil } from './pass-countdown';

const NOW_MS = Date.parse('2026-10-07T12:00:00Z');
const DAY = 86_400;
const HOUR = 3_600;
const MINUTE = 60;
const untilIn = (seconds: number) => NOW_MS / 1000 + seconds;

describe('formatPassRemaining', () => {
  it('prints days, hours and minutes from one day up', () => {
    expect(formatPassRemaining(untilIn(12 * DAY + 4 * HOUR + 30 * MINUTE), NOW_MS)).toBe('12d 4h 30m');
    expect(formatPassRemaining(untilIn(DAY), NOW_MS)).toBe('1d 0h 0m');
  });

  it('drops the days part under a day', () => {
    expect(formatPassRemaining(untilIn(DAY - 1), NOW_MS)).toBe('23h 59m');
    expect(formatPassRemaining(untilIn(4 * HOUR + 30 * MINUTE), NOW_MS)).toBe('4h 30m');
  });

  it('prints only minutes under an hour, and <1m for the last minute', () => {
    expect(formatPassRemaining(untilIn(45 * MINUTE), NOW_MS)).toBe('45m');
    expect(formatPassRemaining(untilIn(30), NOW_MS)).toBe('<1m');
  });

  it('is hidden once expired, at the exact expiry, never owned, or absent', () => {
    expect(formatPassRemaining(untilIn(-1), NOW_MS)).toBeNull();
    expect(formatPassRemaining(untilIn(0), NOW_MS)).toBeNull();
    expect(formatPassRemaining(0, NOW_MS)).toBeNull();
    expect(formatPassRemaining(null, NOW_MS)).toBeNull();
  });
});

describe('readVipUntil', () => {
  const viewWith = (account: Record<string, unknown> | undefined): AccountView =>
    ({ payload: { account }, gameRunning: false, store: { status: 'ok', reason: null, binding: null } }) as unknown as AccountView;

  it('reads account.vip_until and nothing else', () => {
    expect(readVipUntil(viewWith({ vip_until: 1_800_000_000 }))).toBe(1_800_000_000);
    expect(readVipUntil(viewWith({ vip_until: '1800000000' }))).toBeNull();
    expect(readVipUntil(viewWith({}))).toBeNull();
    expect(readVipUntil(viewWith(undefined))).toBeNull();
    expect(readVipUntil(null)).toBeNull();
  });
});
