import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LiveTick } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { readCaptureRecords, type CaptureRecord } from './capture-format.js';
import { EARNINGS_SERIES_POINTS, EarningsFold, MAX_TICK_GAP_MS, type EarningsFoldDeps } from './earnings-fold.js';
import type { LogPort } from './log-port.js';
import { TlsConnections, type TapEvent } from './tls-stream.js';

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

function requireNumber(value: number | null | undefined): number {
  if (value == null) throw new Error('expected a non-null number');
  return value;
}

function makeFold(overrides: Partial<EarningsFoldDeps> = {}): EarningsFold {
  return new EarningsFold({
    now: () => 0,
    xpPerProp: () => 10,
    log: NOOP_LOG,
    ...overrides,
  });
}

function isTick(event: TapEvent): event is { kind: 'tick'; tick: LiveTick } {
  return event.kind === 'tick';
}

function replayCommittedCaptureTicks(): readonly LiveTick[] {
  const capturePath = resolve(__dirname, 'fixtures', 'live-capture.bfcc');
  const records: CaptureRecord[] = [...readCaptureRecords(readFileSync(capturePath))];
  const conn = new TlsConnections();
  const events: TapEvent[] = [];
  for (const record of records) events.push(...conn.push(record.ctx, record.bytes));
  return events.filter(isTick).map((event) => event.tick);
}

describe('EarningsFold: sequence guard', () => {
  it('counts a repeated tick (same sequence) exactly once', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2, undefined);

    // Only one of the two sequence-1 pushes should have landed.
    const singleClock = makeClock();
    const singleFold = makeFold({ now: singleClock.now });
    singleFold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1, undefined);
    singleClock.advance(2_000);
    singleFold.consumeTick(baseTick({}), 2, undefined);

    expect(fold.goldSession).not.toBeNull();
    expect(fold.goldSession).toBe(singleFold.goldSession);
  });

  it('ignores an out-of-order tick (a lower sequence than already consumed)', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 5, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 999 }] }), 3, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 6, undefined);

    const expectedClock = makeClock();
    const expected = makeFold({ now: expectedClock.now });
    expected.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 5, undefined);
    expectedClock.advance(2_000);
    expected.consumeTick(baseTick({}), 6, undefined);

    expect(fold.goldSession).not.toBeNull();
    expect(fold.goldSession).toBe(expected.goldSession);
  });
});

describe('EarningsFold: streamed clock', () => {
  it('accrues time on idle ticks, which lowers the rate as more idle time passes with no new gold', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });

    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 3_600_000 }] }), 1, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({ idle: true }), 2, undefined);
    const rateAfterOneSecond = fold.goldSession;
    expect(rateAfterOneSecond).not.toBeNull();
    expect(fold.sessionSeconds).toBeGreaterThan(0);

    clock.advance(9_000);
    fold.consumeTick(baseTick({ idle: true }), 3, undefined);
    const rateAfterTenSeconds = fold.goldSession;

    expect(rateAfterTenSeconds).not.toBeNull();
    expect(requireNumber(rateAfterTenSeconds)).toBeLessThan(requireNumber(rateAfterOneSecond));
  });

  it('freezes the streamed clock across a stream gap so the rate does not fall across it', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });

    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 1_000 }] }), 1, undefined);
    clock.advance(100);
    fold.consumeTick(baseTick({}), 2, undefined);
    const secondsBeforeGap = fold.sessionSeconds;

    const gapMs = 5 * 60 * 1000;
    clock.advance(gapMs);
    fold.consumeTick(baseTick({}), 3, undefined);

    expect(fold.sessionSeconds).toBeCloseTo(secondsBeforeGap + MAX_TICK_GAP_MS / 1000, 6);

    const uncappedSeconds = secondsBeforeGap + gapMs / 1000;
    const uncappedRate = (1_000 / uncappedSeconds) * 3600;
    // Only the capped 2 seconds ever get credited, never the real 5-minute gap, so the actual rate
    // stays far above what crediting the whole gap would have collapsed it to.
    expect(requireNumber(fold.goldSession)).toBeGreaterThan(uncappedRate * 10);
  });
});

/** Feeds one earning tick, then a follow-up empty tick a second later so `streamedMs` is nonzero
 *  and `xpSession`/`goldSession` report a real rate instead of `null`. */
function foldAfterOneEarningTick(deps: Partial<EarningsFoldDeps>, tick: LiveTick, xpMult: number | undefined): EarningsFold {
  const clock = makeClock();
  const fold = makeFold({ ...deps, now: clock.now });
  fold.consumeTick(tick, 1, xpMult);
  clock.advance(1_000);
  fold.consumeTick(baseTick({}), 2, undefined);
  return fold;
}

describe('EarningsFold: xpMult normalization', () => {
  it('treats an absent xpMult as 1', () => {
    const tick = baseTick({ phase: 1, loot: [{ cell: 0, gold: 1 }] });
    const withImplicitOne = foldAfterOneEarningTick({ xpPerProp: () => 10 }, tick, undefined);
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
    expect(doubled.xpSession).toBe(requireNumber(baseline.xpSession) * 2);
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
      undefined,
    );
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2, undefined);

    expect(fold.goldSession).not.toBeNull();
    expect(Number.isNaN(fold.goldSession)).toBe(false);
    expect(Number.isFinite(fold.goldSession)).toBe(true);

    const expectedClock = makeClock();
    const expected = makeFold({ now: expectedClock.now });
    expected.consumeTick(baseTick({ phase: 1, loot: [{ cell: 2, gold: 500 }] }), 1, undefined);
    expectedClock.advance(1_000);
    expected.consumeTick(baseTick({}), 2, undefined);
    expect(fold.goldSession).toBe(expected.goldSession);
  });
});

describe('EarningsFold: per-tick phase', () => {
  it('values a mid-window phase change at each tick’s own phase, not the latest one retroactively', () => {
    const xpPerProp = vi.fn((phase: number) => (phase === 1 ? 10 : 100));
    const clock = makeClock();
    const fold = makeFold({ xpPerProp, now: clock.now });

    fold.consumeTick(baseTick({ phase: 1, loot: [{ cell: 0, gold: 1 }] }), 1, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({ phase: 2, loot: [{ cell: 0, gold: 1 }] }), 2, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 3, undefined);

    const expectedXp = 1 * 10 * 1 + 1 * 100 * 1;
    expect(fold.xpSession).not.toBeNull();
    // Recover the accumulated XP total from the per-hour rate using the known streamed time.
    const xpTotal = (requireNumber(fold.xpSession) * fold.sessionSeconds) / 3600;
    expect(xpTotal).toBeCloseTo(expectedXp, 6);
  });
});

describe('EarningsFold: 10-minute rolling window', () => {
  it('yields null, never 0 or NaN, when no streamed time has accrued yet', () => {
    const fold = makeFold();
    expect(fold.gold10).toBeNull();
    expect(fold.xp10).toBeNull();
    expect(fold.goldSession).toBeNull();
    expect(fold.xpSession).toBeNull();
    expect(fold.coverageSeconds).toBe(0);
  });

  it('evicts a bucket once it ages past 10 real minutes, shrinking coverage', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2, undefined);
    const coverageJustAfter = fold.coverageSeconds;
    expect(coverageJustAfter).toBeGreaterThan(0);
    expect(fold.gold10).toBeGreaterThan(0);

    clock.advance(10 * 60 * 1000 + 1_000);
    fold.consumeTick(baseTick({}), 3, undefined);

    // The only gold-bearing bucket aged out; what remains is just the bucket this very tick
    // started, which streamed a capped 2 seconds and paid out nothing.
    expect(fold.gold10).toBe(0);
    expect(fold.coverageSeconds).toBeLessThan(coverageJustAfter);
  });

  it('a gap smaller than the 10-minute window evicts nothing', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2, undefined);
    const coverageBefore = fold.coverageSeconds;

    clock.advance(5 * 60 * 1000);
    fold.consumeTick(baseTick({}), 3, undefined);

    expect(fold.gold10).not.toBeNull();
    expect(fold.gold10).toBeGreaterThan(0);
    expect(fold.coverageSeconds).toBeGreaterThan(coverageBefore);
  });

  it('divides the window rate by streamed time, not by the real-time span the window covers', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });

    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 1_000 }] }), 1, undefined);
    clock.advance(500);
    fold.consumeTick(baseTick({}), 2, undefined);

    // No further ticks at all for 5 real minutes: streamed time stays fixed at the 0.5s the two
    // ticks above accrued, while the real span the window covers grows past it by 600x — dividing
    // by that real span instead would land nowhere near the value asserted below.
    clock.advance(5 * 60 * 1000);

    expect(fold.gold10).toBe((1_000 / 0.5) * 3600);
  });

  it('never lets the bucket ring grow past its capacity, even across a long session with no window read in between', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    const totalSeconds = 2 * 60 * 60;
    for (let second = 0; second < totalSeconds; second += 1) {
      fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 1 }] }), second + 1, undefined);
      clock.advance(1_000);
    }

    expect(fold.coverageSeconds).toBeLessThanOrEqual(601);
  });

  it('a steady-state full window reads its true maximum, not one bucket short of it', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    const totalSeconds = 700;
    for (let second = 0; second < totalSeconds; second += 1) {
      fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 1 }] }), second + 1, undefined);
      clock.advance(1_000);
    }

    expect(fold.coverageSeconds).toBeGreaterThanOrEqual(600);
    expect(Math.floor(fold.coverageSeconds / 60)).toBe(10);
  });

  it('a window genuinely short of a minute mark still floors down, unmoved by the bucket-width correction', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1, undefined);
    clock.advance(538_000);
    fold.consumeTick(baseTick({}), 2, undefined);

    expect(fold.coverageSeconds).toBe(539);
    expect(Math.floor(fold.coverageSeconds / 60)).toBe(8);
  });
});

describe('EarningsFold: grid cross-check', () => {
  it('the wave guard prevents a wholesale grid replacement with no real destructions from reading as spurious clears', () => {
    const warn = vi.fn();
    const clock = makeClock();
    const fold = makeFold({ now: clock.now, log: { info: () => undefined, warn } });

    fold.consumeTick({ heroes: [], wave: 1, kinds: [0, -1, 0] }, 1, undefined);
    clock.advance(100);
    // A fresh map spawns with an unrelated layout: cell 0 held a prop and is now empty, but that
    // is the new map simply not spawning one there, not a destruction — nothing paid out either.
    fold.consumeTick({ heroes: [], wave: 2, kinds: [-1, 0, 0] }, 2, undefined);

    expect(warn).not.toHaveBeenCalled();
  });

  it('replaying the committed capture: the two cross-check counters agree exactly, and no divergence warning fires', () => {
    const warn = vi.fn();
    const clock = makeClock();
    const fold = makeFold({ now: clock.now, log: { info: () => undefined, warn } });

    const ticks = replayCommittedCaptureTicks();
    ticks.forEach((tick, index) => {
      fold.consumeTick(tick, index + 1, undefined);
      clock.advance(100);
    });

    // The capture carries 10 loot payouts, but only 9 of them share a tick with their cell's own
    // occupied -> cleared transition — the tenth's clear is masked by a wave rollover (see
    // live-capture.test.ts). The cross-check payout counter only counts a payout on a tick where
    // the grid diff also ran, so the masked payout is excluded from both counters alike: both land
    // on 9, not 9-vs-10, and the divergence warning never fires.
    expect(warn).not.toHaveBeenCalled();
  });

  it('a genuine divergence — a grid clear with no matching payout — still warns with both counts', () => {
    const warn = vi.fn();
    const clock = makeClock();
    const fold = makeFold({ now: clock.now, log: { info: () => undefined, warn } });

    fold.consumeTick({ heroes: [], wave: 1, kinds: [0] }, 1, undefined);
    clock.advance(100);
    // Same wave, so the diff runs; the cell clears but no loot entry ever reports it.
    fold.consumeTick({ heroes: [], wave: 1, kinds: [-1] }, 2, undefined);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'earnings.grid_payout_divergence', gridClears: 1, payoutProps: 0 }),
    );
  });
});

describe('EarningsFold: session totals (goldSessionTotal / xpSessionTotal)', () => {
  it('a fresh fold reports null, never a misleading 0, before any streamed time has accrued', () => {
    const fold = makeFold();
    expect(fold.goldSessionTotal).toBeNull();
    expect(fold.xpSessionTotal).toBeNull();
  });

  it('reports the raw accumulated sum, not divided by streamed time the way the rate is', () => {
    const tick = baseTick({ phase: 1, loot: [{ cell: 0, gold: 1 }] });
    const fold = foldAfterOneEarningTick({ xpPerProp: () => 10 }, tick, undefined);

    // The rate divides by streamed time (1 second here, scaled to per-hour); the total does not.
    expect(fold.goldSessionTotal).toBe(1);
    expect(fold.xpSessionTotal).toBe(10);
    expect(fold.goldSession).not.toBe(fold.goldSessionTotal);
  });

  it('keeps rising across ticks that the rolling 10-minute window would have evicted', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2, undefined);
    const totalBeforeEviction = fold.goldSessionTotal;
    expect(totalBeforeEviction).toBe(100);

    // Past the 10-minute window: gold10 evicts its only gold-bearing bucket, but the session
    // total is not windowed at all and must be untouched by that eviction.
    clock.advance(10 * 60 * 1000 + 1_000);
    fold.consumeTick(baseTick({}), 3, undefined);

    expect(fold.gold10).toBe(0);
    expect(fold.goldSessionTotal).toBe(totalBeforeEviction);
  });
});

describe('EarningsFold: session lifecycle', () => {
  it('app start: a fresh fold has session totals zeroed and the rolling window empty', () => {
    const fold = makeFold();
    expect(fold.goldSession).toBeNull();
    expect(fold.xpSession).toBeNull();
    expect(fold.goldSessionTotal).toBeNull();
    expect(fold.xpSessionTotal).toBeNull();
    expect(fold.sessionSeconds).toBe(0);
    expect(fold.gold10).toBeNull();
    expect(fold.xp10).toBeNull();
    expect(fold.coverageSeconds).toBe(0);
  });

  it('reset control: zeroes session totals and the session clock, but keeps the 10-minute window', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ phase: 1, loot: [{ cell: 0, gold: 100 }] }), 1, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2, undefined);
    expect(fold.goldSession).not.toBeNull();
    expect(fold.goldSessionTotal).not.toBeNull();
    const gold10BeforeReset = fold.gold10;
    const coverageBeforeReset = fold.coverageSeconds;
    expect(gold10BeforeReset).not.toBeNull();

    fold.reset('reset');

    expect(fold.goldSession).toBeNull();
    expect(fold.xpSession).toBeNull();
    expect(fold.goldSessionTotal).toBeNull();
    expect(fold.xpSessionTotal).toBeNull();
    expect(fold.sessionSeconds).toBe(0);
    expect(fold.gold10).toBe(gold10BeforeReset);
    expect(fold.coverageSeconds).toBe(coverageBeforeReset);
  });

  it('account change: zeroes session totals, the session clock, AND clears the 10-minute window', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ phase: 1, loot: [{ cell: 0, gold: 100 }] }), 1, undefined);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2, undefined);
    expect(fold.gold10).not.toBeNull();
    expect(fold.goldSessionTotal).not.toBeNull();

    fold.reset('accountChange');

    expect(fold.goldSession).toBeNull();
    expect(fold.xpSession).toBeNull();
    expect(fold.goldSessionTotal).toBeNull();
    expect(fold.xpSessionTotal).toBeNull();
    expect(fold.sessionSeconds).toBe(0);
    expect(fold.gold10).toBeNull();
    expect(fold.xp10).toBeNull();
    expect(fold.coverageSeconds).toBe(0);
  });

  it('after a reset, a fresh divergence between grid clears and payouts is still logged (the flag reset too)', () => {
    const warn = vi.fn();
    const clock = makeClock();
    const fold = makeFold({ now: clock.now, log: { info: () => undefined, warn } });

    // Same wave both times, so the guard does not skip the diff — but a payout claims a
    // destruction the grid never confirms (the cell stays occupied), so the counts diverge.
    fold.consumeTick({ heroes: [], wave: 1, kinds: [0] }, 1, undefined);
    clock.advance(100);
    fold.consumeTick({ heroes: [], wave: 1, kinds: [0], loot: [{ cell: 0, gold: 100 }] }, 2, undefined);
    expect(warn).toHaveBeenCalledTimes(1);

    fold.reset('reset');
    warn.mockClear();

    fold.consumeTick({ heroes: [], wave: 10, kinds: [0] }, 3, undefined);
    clock.advance(100);
    fold.consumeTick({ heroes: [], wave: 10, kinds: [0], loot: [{ cell: 0, gold: 100 }] }, 4, undefined);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

/**
 * A fold whose streamed clock has already started. The very first tick of a session has no
 * previous tick to measure a gap against, so it contributes zero streamed time — priming here
 * keeps that one-off out of every figure below, which are all about a session already running.
 */
function primedFold(clock: { now: () => number }): EarningsFold {
  const fold = makeFold({ now: clock.now });
  fold.consumeTick(baseTick({ phase: 1 }), 0, undefined);
  return fold;
}

/** `gapMs` of streamed time, then one tick paying `gold` from each of `props` props. */
function pay(
  fold: EarningsFold,
  clock: { advance: (ms: number) => void },
  sequence: number,
  props: number,
  gold: number,
  gapMs = 1_000,
) {
  clock.advance(gapMs);
  fold.consumeTick(
    baseTick({ phase: 1, loot: Array.from({ length: props }, (_, cell) => ({ cell, gold })) }),
    sequence,
    undefined,
  );
}

describe('EarningsFold: measured per-prop figures', () => {
  it('divides window gold by the props that actually paid it, with no wiki value involved', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now, xpPerProp: () => 999 });
    fold.consumeTick(baseTick({ phase: 1 }), 0, undefined);

    pay(fold, clock, 1, 2, 100);
    pay(fold, clock, 2, 2, 300);

    // Four props paid 800 gold between them, and the 999 xp-per-prop never enters it.
    expect(fold.goldPerProp10).toBe(200);
  });

  it('reports no gold-per-prop while nothing has broken, rather than a rate of zero', () => {
    const clock = makeClock();
    const fold = primedFold(clock);

    clock.advance(30_000);
    fold.consumeTick(baseTick({ idle: true }), 1, undefined);

    expect(fold.propsPerMinute10).toBe(0);
    expect(fold.goldPerProp10).toBeNull();
  });

  it('measures prop throughput against streamed time, so a stream gap is not a throughput collapse', () => {
    const clock = makeClock();
    const fold = primedFold(clock);
    for (let sequence = 1; sequence <= 10; sequence += 1) pay(fold, clock, sequence, 2, 50);

    expect(fold.propsPerMinute10).toBe(120);

    // Five real minutes with no ticks at all. The streamed clock only ever takes the per-tick cap
    // from a gap, so the reading loses the two seconds that cap allows and nothing else.
    pay(fold, clock, 11, 0, 0, 5 * 60_000);

    expect(fold.propsPerMinute10).toBe(100);
    // Against wall-clock time the same 20 props would have read under 4 per minute — which is the
    // number this deliberately does not print.
    expect((20 / (5 * 60 + 10)) * 60).toBeLessThan(4);
  });

  it('counts the session prop total independently of the rolling window', () => {
    const clock = makeClock();
    const fold = primedFold(clock);

    pay(fold, clock, 1, 3, 10);
    pay(fold, clock, 2, 4, 10);

    expect(fold.propsSessionTotal).toBe(7);
  });

  it('has no session prop total before any tick has been streamed', () => {
    expect(makeFold().propsSessionTotal).toBeNull();
  });

  it('zeroes the session prop count on reset while the window keeps its own props', () => {
    const clock = makeClock();
    const fold = primedFold(clock);
    pay(fold, clock, 1, 5, 100);

    fold.reset('reset');

    expect(fold.propsSessionTotal).toBeNull();
    expect(fold.goldPerProp10).toBe(100);
  });

  it('clears the window too when the samples turn out to belong to another account', () => {
    const clock = makeClock();
    const fold = primedFold(clock);
    pay(fold, clock, 1, 5, 100);

    fold.reset('accountChange');

    expect(fold.goldPerProp10).toBeNull();
    expect(fold.propsPerMinute10).toBeNull();
  });
});

describe('EarningsFold: the rolling window as a series', () => {
  it('reports only the span it has actually covered, not ten minutes of mostly nothing', () => {
    const clock = makeClock();
    const fold = primedFold(clock);
    pay(fold, clock, 1, 1, 100);

    // A one-second-old session covers one slice. Reporting sixty would pin every reading a young
    // session has into the last sixtieth of whatever draws it.
    expect(fold.gold10Series).toHaveLength(1);
  });

  it('grows toward the whole window as the session ages, and stops there', () => {
    const clock = makeClock();
    const fold = primedFold(clock);
    pay(fold, clock, 1, 1, 100);
    const atOneSecond = fold.gold10Series.length;

    pay(fold, clock, 2, 1, 100, 120_000);
    const atTwoMinutes = fold.gold10Series.length;

    expect(atOneSecond).toBe(1);
    expect(atTwoMinutes).toBe(13);
    expect(atTwoMinutes).toBeLessThanOrEqual(EARNINGS_SERIES_POINTS);
  });

  it('is empty when nothing has been streamed at all, rather than a row of zeroes', () => {
    expect(makeFold().gold10Series).toEqual([]);
  });

  it('keeps a gap inside the covered span, so a stream that stopped is not drawn as a rate', () => {
    const clock = makeClock();
    const fold = primedFold(clock);
    pay(fold, clock, 1, 1, 100);
    // A minute of silence, then payouts resume: the slices in between were covered by the window
    // and genuinely have no reading.
    pay(fold, clock, 2, 1, 100, 60_000);

    const series = fold.gold10Series;
    expect(series[0]).not.toBeNull();
    expect(series[series.length - 1]).not.toBeNull();
    expect(series.slice(1, -1).some((value) => value === null)).toBe(true);
  });

  it('puts the newest reading at the end, where the line ends', () => {
    const clock = makeClock();
    const fold = primedFold(clock);

    pay(fold, clock, 1, 1, 100);
    pay(fold, clock, 2, 1, 900, 30_000);

    const series = fold.gold10Series;
    const readings = series.filter((value): value is number => value !== null);
    expect(readings).toHaveLength(2);
    expect(requireNumber(series[series.length - 1])).toBeGreaterThan(requireNumber(readings[0]));
  });

  it('averages a slice over the seconds inside it rather than summing them', () => {
    const clock = makeClock();
    const fold = primedFold(clock);

    // Two payouts one second apart, both landing in the same ten-second slice.
    pay(fold, clock, 1, 1, 1_000);
    pay(fold, clock, 2, 1, 1_000);

    const series = fold.gold10Series;
    expect(series).toHaveLength(1);
    // 2000 gold over two streamed seconds is 3.6m/hr — not the 7.2m that adding two one-second
    // rates together would have produced.
    expect(series[0]).toBe(3_600_000);
  });

  it('drops a reading out of the series once it has aged past the window', () => {
    const clock = makeClock();
    const fold = primedFold(clock);
    pay(fold, clock, 1, 1, 100);

    clock.advance(11 * 60_000);

    expect(fold.gold10Series).toEqual([]);
  });
});
