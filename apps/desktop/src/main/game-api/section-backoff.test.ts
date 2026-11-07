import { describe, expect, it } from 'vitest';
import type { AccountSection } from '@bombfarm/contracts';
import type { SectionOutcome } from '@bombfarm/game-api';
import { createSectionBackoff } from './section-backoff.js';

const OK: SectionOutcome = { kind: 'ok', body: {}, absentUnreadKeys: [] };
const TOO_LARGE: SectionOutcome = { kind: 'failed', reason: 'too_large', bytes: 40_000_000 };
const TIMED_OUT: SectionOutcome = { kind: 'failed', reason: 'transport_error', detail: 'request timed out' };

function cycle(overrides: Partial<Record<AccountSection, SectionOutcome>>): Record<AccountSection, SectionOutcome> {
  return { account: OK, heroes: OK, skills: OK, casa: OK, items: OK, ...overrides };
}

describe('createSectionBackoff', () => {
  it('forgives one failed read: the next cycle tries again', () => {
    const backoff = createSectionBackoff();
    expect(backoff.record(cycle({ items: TIMED_OUT }), 0)).toEqual([]);
    expect(backoff.isResting('items', 1)).toBe(false);
  });

  it('rests a route that keeps failing, doubling up to fifteen minutes', () => {
    const backoff = createSectionBackoff();
    const rests: number[] = [];
    let now = 0;
    for (let n = 0; n < 7; n += 1) {
      rests.push(...backoff.record(cycle({ items: TOO_LARGE }), now).map((rest) => rest.restMs));
      now += 1_000_000;
    }
    expect(rests).toEqual([120_000, 240_000, 480_000, 900_000, 900_000, 900_000]);
  });

  it('retries once the rest is over, and leaves the other routes alone during it', () => {
    const backoff = createSectionBackoff();
    backoff.record(cycle({ items: TOO_LARGE }), 0);
    backoff.record(cycle({ items: TOO_LARGE }), 60_000);
    expect(backoff.isResting('items', 179_999)).toBe(true);
    expect(backoff.isResting('heroes', 179_999)).toBe(false);
    expect(backoff.isResting('items', 180_000)).toBe(false);
  });

  it('holds its strikes across cycles that skipped the route', () => {
    const backoff = createSectionBackoff();
    backoff.record(cycle({ items: TOO_LARGE }), 0);
    backoff.record(cycle({ items: TOO_LARGE }), 1);
    backoff.record(cycle({ items: { kind: 'failed', reason: 'backed_off' } }), 2);
    expect(backoff.record(cycle({ items: TOO_LARGE }), 3)).toEqual([{ section: 'items', strikes: 3, restMs: 240_000 }]);
  });

  it('starts over after a good read', () => {
    const backoff = createSectionBackoff();
    backoff.record(cycle({ items: TOO_LARGE }), 0);
    backoff.record(cycle({ items: TOO_LARGE }), 1);
    backoff.record(cycle({}), 200_000);
    expect(backoff.isResting('items', 200_001)).toBe(false);
    expect(backoff.record(cycle({ items: TOO_LARGE }), 200_002)).toEqual([]);
  });

  it('does not blame a route when every route failed, so waking a laptop reads straight away', () => {
    const backoff = createSectionBackoff();
    const everyRoute = cycle({ account: TIMED_OUT, heroes: TIMED_OUT, skills: TIMED_OUT, casa: TIMED_OUT, items: TIMED_OUT });
    backoff.record(everyRoute, 0);
    backoff.record(everyRoute, 1);
    backoff.record(everyRoute, 2);
    expect(backoff.isResting('items', 3)).toBe(false);
  });

  it('a player asking ends the rest, but another failure carries on up the ladder', () => {
    const backoff = createSectionBackoff();
    backoff.record(cycle({ items: TOO_LARGE }), 0);
    backoff.record(cycle({ items: TOO_LARGE }), 1);
    backoff.wake();
    expect(backoff.isResting('items', 2)).toBe(false);
    expect(backoff.record(cycle({ items: TOO_LARGE }), 3)).toEqual([{ section: 'items', strikes: 3, restMs: 240_000 }]);
  });

  it('a new session starts with a clean slate', () => {
    const backoff = createSectionBackoff();
    backoff.record(cycle({ items: TOO_LARGE }), 0);
    backoff.record(cycle({ items: TOO_LARGE }), 1);
    backoff.reset();
    expect(backoff.isResting('items', 2)).toBe(false);
    expect(backoff.record(cycle({ items: TOO_LARGE }), 3)).toEqual([]);
  });

  it('does not wait out a retry time left behind by the clock moving back', () => {
    const backoff = createSectionBackoff();
    const twoHoursLater = 7_200_000;
    backoff.record(cycle({ items: TOO_LARGE }), twoHoursLater);
    backoff.record(cycle({ items: TOO_LARGE }), twoHoursLater);
    expect(backoff.isResting('items', 0)).toBe(false);
  });

  it('leaves refusals the pacing gate or the player owns to them', () => {
    const backoff = createSectionBackoff();
    const refused: SectionOutcome = { kind: 'failed', reason: 'cooldown' };
    backoff.record(cycle({ items: refused }), 0);
    backoff.record(cycle({ items: refused }), 1);
    expect(backoff.isResting('items', 2)).toBe(false);
  });
});
