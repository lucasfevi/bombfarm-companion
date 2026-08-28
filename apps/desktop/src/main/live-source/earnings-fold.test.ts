import type { LiveTick } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { EarningsFold, MAX_TICK_GAP_MS, type EarningsFoldDeps } from './earnings-fold.js';
import type { LogPort } from './log-port.js';

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined };

function baseTick(overrides: Partial<LiveTick> = {}): LiveTick {
  return { heroes: [], ...overrides };
}

function makeClock(startAt = 0): { now: () => number; advance: (ms: number) => void } {
  let current = startAt;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function makeFold(overrides: Partial<EarningsFoldDeps> = {}): EarningsFold {
  return new EarningsFold({
    now: () => 0,
    xpPerProp: () => 10,
    log: NOOP_LOG,
    ...overrides,
  });
}

describe('EarningsFold: sequence guard', () => {
  it('counts a repeated tick (same sequence) exactly once', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1);
    clock.advance(1_000);
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2);

    // Only one of the two sequence-1 pushes should have landed.
    const singleClock = makeClock();
    const singleFold = makeFold({ now: singleClock.now });
    singleFold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1);
    singleClock.advance(2_000);
    singleFold.consumeTick(baseTick({}), 2);

    expect(fold.goldSession).not.toBeNull();
    expect(fold.goldSession).toBe(singleFold.goldSession);
  });

  it('ignores an out-of-order tick (a lower sequence than already consumed)', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 5);
    clock.advance(1_000);
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 999 }] }), 3);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 6);

    const expectedClock = makeClock();
    const expected = makeFold({ now: expectedClock.now });
    expected.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 5);
    expectedClock.advance(2_000);
    expected.consumeTick(baseTick({}), 6);

    expect(fold.goldSession).not.toBeNull();
    expect(fold.goldSession).toBe(expected.goldSession);
  });
});

describe('EarningsFold: streamed clock', () => {
  it('accrues time on idle ticks, which lowers the rate as more idle time passes with no new gold', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });

    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 3_600_000 }] }), 1);
    clock.advance(1_000);
    fold.consumeTick(baseTick({ idle: true }), 2);
    const rateAfterOneSecond = fold.goldSession;
    expect(rateAfterOneSecond).not.toBeNull();
    expect(fold.sessionSeconds).toBeGreaterThan(0);

    clock.advance(9_000);
    fold.consumeTick(baseTick({ idle: true }), 3);
    const rateAfterTenSeconds = fold.goldSession;

    expect(rateAfterTenSeconds).not.toBeNull();
    expect(rateAfterTenSeconds!).toBeLessThan(rateAfterOneSecond!);
  });

  it('freezes the streamed clock across a stream gap so the rate does not fall across it', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });

    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 1_000 }] }), 1);
    clock.advance(100);
    fold.consumeTick(baseTick({}), 2);
    const secondsBeforeGap = fold.sessionSeconds;

    const gapMs = 5 * 60 * 1000;
    clock.advance(gapMs);
    fold.consumeTick(baseTick({}), 3);

    expect(fold.sessionSeconds).toBeCloseTo(secondsBeforeGap + MAX_TICK_GAP_MS / 1000, 6);

    const uncappedSeconds = secondsBeforeGap + gapMs / 1000;
    const uncappedRate = (1_000 / uncappedSeconds) * 3600;
    // Only the capped 2 seconds ever get credited, never the real 5-minute gap, so the actual rate
    // stays far above what crediting the whole gap would have collapsed it to.
    expect(fold.goldSession!).toBeGreaterThan(uncappedRate * 10);
  });
});

/** Feeds one earning tick, then a follow-up empty tick a second later so `streamedMs` is nonzero
 *  and `xpSession`/`goldSession` report a real rate instead of `null`. */
function foldAfterOneEarningTick(deps: Partial<EarningsFoldDeps>, tick: LiveTick, xpMult?: number): EarningsFold {
  const clock = makeClock();
  const fold = makeFold({ ...deps, now: clock.now });
  fold.consumeTick(tick, 1, xpMult);
  clock.advance(1_000);
  fold.consumeTick(baseTick({}), 2);
  return fold;
}

describe('EarningsFold: xpMult normalization', () => {
  it('treats an absent xpMult as 1', () => {
    const tick = baseTick({ phase: 1, loot: [{ cell: 0, gold: 1 }] });
    const withImplicitOne = foldAfterOneEarningTick({ xpPerProp: () => 10 }, tick);
    const explicit = foldAfterOneEarningTick({ xpPerProp: () => 10 }, tick, 1);
    expect(withImplicitOne.xpSession).not.toBeNull();
    expect(withImplicitOne.xpSession).toBe(explicit.xpSession);
  });

  it('treats a literal 0 xpMult as 1, never zeroing the XP figure', () => {
    const tick = baseTick({ phase: 1, loot: [{ cell: 0, gold: 1 }] });
    const zeroed = foldAfterOneEarningTick({ xpPerProp: () => 10 }, tick, 0);
    const explicit = foldAfterOneEarningTick({ xpPerProp: () => 10 }, tick, 1);
    expect(zeroed.xpSession).toBe(explicit.xpSession);
    expect(zeroed.xpSession).not.toBe(0);
  });

  it('still scales by a genuine non-1 finite xpMult', () => {
    const tick = baseTick({ phase: 1, loot: [{ cell: 0, gold: 1 }] });
    const doubled = foldAfterOneEarningTick({ xpPerProp: () => 10 }, tick, 2);
    const baseline = foldAfterOneEarningTick({ xpPerProp: () => 10 }, tick, 1);
    expect(doubled.xpSession).toBe(baseline.xpSession! * 2);
  });
});

describe('EarningsFold: payout parsing', () => {
  it('skips a non-finite payout rather than letting NaN reach any output', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(
      baseTick({
        phase: 1,
        loot: [
          { cell: 0, gold: Number.NaN },
          { cell: 1, gold: Number.POSITIVE_INFINITY },
          { cell: 2, gold: 500 },
        ],
      }),
      1,
    );
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2);

    expect(fold.goldSession).not.toBeNull();
    expect(Number.isNaN(fold.goldSession)).toBe(false);
    expect(Number.isFinite(fold.goldSession)).toBe(true);

    const expectedClock = makeClock();
    const expected = makeFold({ now: expectedClock.now });
    expected.consumeTick(baseTick({ phase: 1, loot: [{ cell: 2, gold: 500 }] }), 1);
    expectedClock.advance(1_000);
    expected.consumeTick(baseTick({}), 2);
    expect(fold.goldSession).toBe(expected.goldSession);
  });
});

describe('EarningsFold: per-tick phase', () => {
  it('values a mid-window phase change at each tick’s own phase, not the latest one retroactively', () => {
    const xpPerProp = vi.fn((phase: number) => (phase === 1 ? 10 : 100));
    const clock = makeClock();
    const fold = makeFold({ xpPerProp, now: clock.now });

    fold.consumeTick(baseTick({ phase: 1, loot: [{ cell: 0, gold: 1 }] }), 1);
    clock.advance(1_000);
    fold.consumeTick(baseTick({ phase: 2, loot: [{ cell: 0, gold: 1 }] }), 2);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 3);

    const expectedXp = 1 * 10 * 1 + 1 * 100 * 1;
    expect(fold.xpSession).not.toBeNull();
    // Recover the accumulated XP total from the per-hour rate using the known streamed time.
    const xpTotal = (fold.xpSession! * fold.sessionSeconds) / 3600;
    expect(xpTotal).toBeCloseTo(expectedXp, 6);
  });
});
