import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LiveTick } from '@bombfarm/contracts';
import { describe, expect, it, vi } from 'vitest';
import { readCaptureRecords, type CaptureRecord } from './capture-format.js';
import { EarningsFold, MAX_TICK_GAP_MS, type EarningsFoldDeps } from './earnings-fold.js';
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

function requireNumber(value: number | null): number {
  if (value === null) throw new Error('expected a non-null number');
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
    expect(requireNumber(rateAfterTenSeconds)).toBeLessThan(requireNumber(rateAfterOneSecond));
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
    expect(requireNumber(fold.goldSession)).toBeGreaterThan(uncappedRate * 10);
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
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2);
    const coverageJustAfter = fold.coverageSeconds;
    expect(coverageJustAfter).toBeGreaterThan(0);
    expect(fold.gold10).toBeGreaterThan(0);

    clock.advance(10 * 60 * 1000 + 1_000);
    fold.consumeTick(baseTick({}), 3);

    // The only gold-bearing bucket aged out; what remains is just the bucket this very tick
    // started, which streamed a capped 2 seconds and paid out nothing.
    expect(fold.gold10).toBe(0);
    expect(fold.coverageSeconds).toBeLessThan(coverageJustAfter);
  });

  it('a gap smaller than the 10-minute window evicts nothing', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 100 }] }), 1);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2);
    const coverageBefore = fold.coverageSeconds;

    clock.advance(5 * 60 * 1000);
    fold.consumeTick(baseTick({}), 3);

    expect(fold.gold10).not.toBeNull();
    expect(fold.gold10).toBeGreaterThan(0);
    expect(fold.coverageSeconds).toBeGreaterThan(coverageBefore);
  });

  it('never lets the bucket ring grow past its capacity, even across a long session with no window read in between', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    const totalSeconds = 2 * 60 * 60;
    for (let second = 0; second < totalSeconds; second += 1) {
      fold.consumeTick(baseTick({ loot: [{ cell: 0, gold: 1 }] }), second + 1);
      clock.advance(1_000);
    }

    expect(fold.coverageSeconds).toBeLessThanOrEqual(601);
  });
});

describe('EarningsFold: grid cross-check', () => {
  it('the wave guard prevents a wholesale grid replacement with no real destructions from reading as spurious clears', () => {
    const warn = vi.fn();
    const clock = makeClock();
    const fold = makeFold({ now: clock.now, log: { info: () => undefined, warn } });

    fold.consumeTick({ heroes: [], wave: 1, kinds: [0, -1, 0] }, 1);
    clock.advance(100);
    // A fresh map spawns with an unrelated layout: cell 0 held a prop and is now empty, but that
    // is the new map simply not spawning one there, not a destruction — nothing paid out either.
    fold.consumeTick({ heroes: [], wave: 2, kinds: [-1, 0, 0] }, 2);

    expect(warn).not.toHaveBeenCalled();
  });

  it('replaying the committed capture logs the divergence the wave rollover masks exactly once, with both counts', () => {
    const warn = vi.fn();
    const clock = makeClock();
    const fold = makeFold({ now: clock.now, log: { info: () => undefined, warn } });

    const ticks = replayCommittedCaptureTicks();
    ticks.forEach((tick, index) => {
      fold.consumeTick(tick, index + 1);
      clock.advance(100);
    });

    // The capture carries 10 loot payouts but only 9 of them share a tick with their cell's own
    // occupied -> cleared transition; the tenth's clear is masked by a wave rollover (see
    // live-capture.test.ts), which the wave guard correctly declines to count. That is a genuine,
    // expected one-payout gap — not a bug — and it must still surface exactly once.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'earnings.grid_payout_divergence', gridClears: 9, payoutProps: 10 }),
    );
  });
});

describe('EarningsFold: session lifecycle', () => {
  it('app start: a fresh fold has session totals zeroed and the rolling window empty', () => {
    const fold = makeFold();
    expect(fold.goldSession).toBeNull();
    expect(fold.xpSession).toBeNull();
    expect(fold.sessionSeconds).toBe(0);
    expect(fold.gold10).toBeNull();
    expect(fold.xp10).toBeNull();
    expect(fold.coverageSeconds).toBe(0);
  });

  it('reset control: zeroes session totals and the session clock, but keeps the 10-minute window', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ phase: 1, loot: [{ cell: 0, gold: 100 }] }), 1);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2);
    expect(fold.goldSession).not.toBeNull();
    const gold10BeforeReset = fold.gold10;
    const coverageBeforeReset = fold.coverageSeconds;
    expect(gold10BeforeReset).not.toBeNull();

    fold.reset('reset');

    expect(fold.goldSession).toBeNull();
    expect(fold.xpSession).toBeNull();
    expect(fold.sessionSeconds).toBe(0);
    expect(fold.gold10).toBe(gold10BeforeReset);
    expect(fold.coverageSeconds).toBe(coverageBeforeReset);
  });

  it('account change: zeroes session totals, the session clock, AND clears the 10-minute window', () => {
    const clock = makeClock();
    const fold = makeFold({ now: clock.now });
    fold.consumeTick(baseTick({ phase: 1, loot: [{ cell: 0, gold: 100 }] }), 1);
    clock.advance(1_000);
    fold.consumeTick(baseTick({}), 2);
    expect(fold.gold10).not.toBeNull();

    fold.reset('accountChange');

    expect(fold.goldSession).toBeNull();
    expect(fold.xpSession).toBeNull();
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
    fold.consumeTick({ heroes: [], wave: 1, kinds: [0] }, 1);
    clock.advance(100);
    fold.consumeTick({ heroes: [], wave: 1, kinds: [0], loot: [{ cell: 0, gold: 100 }] }, 2);
    expect(warn).toHaveBeenCalledTimes(1);

    fold.reset('reset');
    warn.mockClear();

    fold.consumeTick({ heroes: [], wave: 10, kinds: [0] }, 3);
    clock.advance(100);
    fold.consumeTick({ heroes: [], wave: 10, kinds: [0], loot: [{ cell: 0, gold: 100 }] }, 4);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
