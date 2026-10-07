import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type {
  CreditAmounts,
  LiveBomb,
  LiveDamage,
  LiveHit,
  LiveTick,
  LiveTickHero,
  UnattributedReason,
} from '@bombfarm/contracts';
import {
  createLiveDamageAttributor,
  type ConsumeOptions,
  type FingerprintDisagreement,
  type FrameCredit,
  type LiveDamageAttributor,
  type RosterCombatFact,
} from '@bombfarm/game-data';
import { describe, expect, it, vi } from 'vitest';
import { readCaptureRecords } from './capture-format.js';
import { DamageFold } from './damage-fold.js';
import { EarningsFold, MAX_TICK_GAP_MS, TEN_MINUTES_MS } from './earnings-fold.js';
import type { LogPort } from './log-port.js';
import { TlsConnections, type TapEvent } from './tls-stream.js';

const FRAME_MS = 200;
const FUSE = 1.6;
const ALL_REASONS: readonly UnattributedReason[] = [
  'noOwnerAtBirth',
  'explosionWithoutBomb',
  'streamDiscontinuity',
  'unresolvedOverlap',
  'explosionlessWithoutFantasma',
  'sharedOrUnattributedKill',
  'noHitOnLootCell',
];

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined };

const hero = (id: string, cell?: number): LiveTickHero => (cell === undefined ? { id } : { id, cell });
const freshBomb = (cell: number, fuseTotalSeconds = FUSE): LiveBomb => ({
  cell,
  radius: 2,
  fuseRemainingSeconds: fuseTotalSeconds - 0.1,
  fuseTotalSeconds,
});
const burningBomb = (cell: number, fuseRemainingSeconds: number): LiveBomb => ({
  cell,
  radius: 2,
  fuseRemainingSeconds,
  fuseTotalSeconds: FUSE,
});
const blast = (cell: number) => ({ cell, radius: 2 });
const hit = (cell: number, damage: number, extra: Partial<LiveHit> = {}): LiveHit => ({ cell, damage, ...extra });
const tick = (parts: Partial<LiveTick> = {}): LiveTick => ({ heroes: [], ...parts });

function makeClock(startAt = 1_000_000): { now: () => number; advance: (ms: number) => void } {
  let current = startAt;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

function sumAmounts(entries: Iterable<CreditAmounts>): CreditAmounts {
  const total = { damage: 0, props: 0, gold: 0 };
  for (const entry of entries) {
    total.damage += entry.damage;
    total.props += entry.props;
    total.gold += entry.gold;
  }
  return total;
}

function expectReconciled(view: LiveDamage | null): void {
  if (view === null) return;
  const accounted = sumAmounts([...view.heroes, ...Object.values(view.unattributedReasons)]);
  expect(accounted).toEqual(view.team);
  if (view.unattributed !== null) {
    const { dps: _dps, ...amounts } = view.unattributed;
    expect(amounts).toEqual(sumAmounts(Object.values(view.unattributedReasons)));
  }
}

function requireView(fold: DamageFold): LiveDamage {
  const view = fold.view;
  if (view === null) throw new Error('expected a damage view');
  return view;
}

function requireNumber(value: number | null | undefined): number {
  if (value == null) throw new Error('expected a non-null number');
  return value;
}

function rowFor(view: LiveDamage, heroId: string) {
  return view.heroes.find((row) => row.heroId === heroId);
}

interface HarnessOptions {
  readonly attributor?: LiveDamageAttributor;
  readonly log?: LogPort;
}

function makeHarness(options: HarnessOptions = {}) {
  const clock = makeClock();
  const fold = new DamageFold({
    now: clock.now,
    log: options.log ?? NOOP_LOG,
    ...(options.attributor ? { attributor: options.attributor } : {}),
  });
  let sequence = 0;
  const step = (parts: Partial<LiveTick> = {}, advanceMs = FRAME_MS): void => {
    clock.advance(advanceMs);
    sequence += 1;
    fold.consumeTick(tick(parts), sequence);
    expectReconciled(fold.view);
  };
  const stepWithSequence = (parts: Partial<LiveTick>, frameSequence: number, advanceMs = FRAME_MS): void => {
    clock.advance(advanceMs);
    fold.consumeTick(tick(parts), frameSequence);
  };
  return { clock, fold, step, stepWithSequence };
}

function creditOf(parts: Partial<FrameCredit> = {}): FrameCredit {
  const zero = { damage: 0, props: 0, gold: 0 };
  return {
    team: zero,
    perHero: new Map(),
    unattributed: Object.fromEntries(ALL_REASONS.map((reason) => [reason, zero])) as Record<
      UnattributedReason,
      CreditAmounts
    >,
    present: [],
    bombs: { births: 0, adopted: 0, owned: 0, cellOwnerConflicts: 0 },
    hits: { total: 0, attributed: 0 },
    disagreements: [],
    ...parts,
  };
}

function fakeAttributor(script: (call: number, tick: LiveTick) => FrameCredit) {
  const seen = { options: [] as ConsumeOptions[], forgotten: 0, cleared: 0, rosters: [] as RosterCombatFact[][] };
  const attributor: LiveDamageAttributor = {
    setRoster: (facts) => {
      seen.rosters.push([...facts]);
    },
    consume: (frame, options) => {
      seen.options.push(options);
      return script(seen.options.length, frame);
    },
    clear: () => {
      seen.cleared += 1;
    },
    forgetLiveBombs: () => {
      seen.forgotten += 1;
    },
  };
  return { attributor, seen };
}

function recordingLog() {
  const records: Record<string, unknown>[] = [];
  const log: LogPort = {
    info: (record) => {
      records.push(record);
    },
    warn: (record) => {
      records.push(record);
    },
  };
  const eventsOf = (event: string) => records.filter((record) => record.event === event);
  return { log, eventsOf };
}

describe('DamageFold: team damage per second', () => {
  it('has no view before the first frame', () => {
    const { fold } = makeHarness();
    expect(fold.view).toBeNull();
  });

  it('sums every hit, second-blast and shard hits and explosion-less ones included, over the streamed seconds, in both windows', () => {
    const { fold, step } = makeHarness();
    step({ hits: [hit(10, 10)] });
    step({ hits: [hit(10, 20, { secondBlast: true }), hit(12, 30, { shardOrigin: 5 })] });
    step({ hits: [hit(10, 40)] });

    const view = requireView(fold);
    expect(view.team.damage).toBe(100);
    expect(view.sessionSeconds).toBeCloseTo(0.4, 9);
    expect(view.teamDpsSession).toBeCloseTo(250, 6);
    expect(view.teamDps10).toBeCloseTo(250, 6);
  });

  it('credits the first frame with zero streamed seconds, so a rate needs a second frame', () => {
    const { fold, step } = makeHarness();
    step({ hits: [hit(10, 50)] });

    const view = requireView(fold);
    expect(view.sessionSeconds).toBe(0);
    expect(view.teamDpsSession).toBeNull();
    expect(view.teamDps10).toBeNull();
    expect(view.team.damage).toBe(50);
  });

  it('counts the streamed seconds of idle frames in the denominator', () => {
    const { fold, step } = makeHarness();
    step({ hits: [hit(10, 100)] });
    step({ idle: true });
    step({ idle: true });

    const view = requireView(fold);
    expect(view.sessionSeconds).toBeCloseTo(0.4, 9);
    expect(view.teamDpsSession).toBeCloseTo(250, 6);
  });

  it('grows the denominator by exactly the gap cap across a longer gap and adds no damage for it', () => {
    const { fold, step } = makeHarness();
    step({ hits: [hit(10, 100)] });
    step({}, 60_000);

    const view = requireView(fold);
    expect(view.sessionSeconds).toBe(MAX_TICK_GAP_MS / 1000);
    expect(view.team.damage).toBe(100);
    expect(view.teamDpsSession).toBe(50);
  });

  it('divides the 10-minute window by the capped streamed seconds across a long gap, not by the gap', () => {
    const { fold, step } = makeHarness();
    step({});
    step({});
    step({ hits: [hit(10, 100)] }, 60_000);

    const view = requireView(fold);
    expect(view.sessionSeconds).toBeCloseTo(0.2 + 2, 9);
    expect(view.teamDps10).toBeCloseTo(100 / 2.2, 9);
    expect(view.teamDpsSession).toBeCloseTo(100 / 2.2, 9);
  });

  it('reports coverageSeconds exactly as the earnings fold does on the same frames', () => {
    const clock = makeClock();
    const damage = new DamageFold({ now: clock.now, log: NOOP_LOG });
    const earnings = new EarningsFold({ now: clock.now, xpPerProp: () => 1, log: NOOP_LOG });
    for (let sequence = 1; sequence <= 12; sequence += 1) {
      clock.advance(sequence === 7 ? 90_000 : FRAME_MS);
      damage.consumeTick(tick(), sequence);
      earnings.consumeTick(tick(), sequence, undefined);
    }
    expect(requireView(damage).coverageSeconds).toBe(earnings.coverageSeconds);
    expect(requireView(damage).coverageSeconds).toBeGreaterThan(90);
  });

  it('evicts a team sample from the 10-minute window once it is older than ten minutes, keeping it in the session', () => {
    const { fold, step } = makeHarness();
    step({ hits: [hit(10, 1_000)] });
    step({});
    step({}, TEN_MINUTES_MS + 5_000);
    step({});

    const view = requireView(fold);
    expect(view.teamDps10).toBe(0);
    expect(view.team.damage).toBe(1_000);
    expect(requireNumber(view.teamDpsSession)).toBeGreaterThan(0);
  });
});

describe('DamageFold: the process-level counter', () => {
  it('ignores a repeated counter', () => {
    const { fold, step, stepWithSequence } = makeHarness();
    step({ hits: [hit(10, 10)] });
    stepWithSequence({ hits: [hit(10, 10)] }, 1);

    expect(requireView(fold).team.damage).toBe(10);
    expect(requireView(fold).sessionSeconds).toBe(0);
  });

  it('ignores an older counter', () => {
    const { fold, stepWithSequence } = makeHarness();
    stepWithSequence({ hits: [hit(10, 10)] }, 5);
    stepWithSequence({ hits: [hit(10, 999)] }, 3);
    stepWithSequence({ hits: [hit(10, 20)] }, 6);

    expect(requireView(fold).team.damage).toBe(30);
  });

  it('still ignores the repeated counter after a reset, since the stream keeps its numbering', () => {
    const { fold, stepWithSequence } = makeHarness();
    stepWithSequence({ hits: [hit(10, 10)] }, 1);
    fold.reset('reset');
    stepWithSequence({ hits: [hit(10, 10)] }, 1);

    expect(requireView(fold).team.damage).toBe(0);
  });

  it('keeps the clock across a reset, so the first frame after it still streams its gap', () => {
    const { fold, step } = makeHarness();
    step({});
    step({});
    fold.reset('reset');
    step({});

    expect(requireView(fold).sessionSeconds).toBeCloseTo(0.2, 9);
  });
});

describe('DamageFold: field seconds and hero rows', () => {
  it('gives every hero in the frame list that frame\'s streamed seconds and nobody else', () => {
    const { fold, step } = makeHarness();
    const both = [hero('A', 100), hero('B', 110)];
    step({ heroes: both, bombs: [freshBomb(100, 1.6), freshBomb(110, 1.5)] });
    step({ heroes: both, explosions: [blast(100), blast(110)], hits: [hit(101, 50), hit(111, 50)] });
    step({ heroes: [hero('A', 100)] });

    const view = requireView(fold);
    expect(rowFor(view, 'A')).toMatchObject({ damage: 50, onField: true });
    expect(rowFor(view, 'B')).toMatchObject({ damage: 50, onField: false });
    expect(rowFor(view, 'A')?.dps).toBeCloseTo(50 / 0.4, 6);
    expect(rowFor(view, 'B')?.dps).toBeCloseTo(50 / 0.2, 6);
  });

  it('divides a hero\'s session damage by its field seconds', () => {
    const { fold, step } = makeHarness();
    step({ heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    step({ heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 50)] });
    step({ heroes: [hero('A', 100)] });

    const row = rowFor(requireView(fold), 'A');
    expect(row?.damage).toBe(50);
    expect(row?.dps).toBeCloseTo(50 / 0.4, 6);
  });

  it('keeps a hero\'s credit and adds no field seconds for the frames after it left while its bomb burst', () => {
    const { fold, step } = makeHarness();
    step({ heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    step({ heroes: [hero('A', 100)], bombs: [burningBomb(100, FUSE - 0.3)] });
    step({ heroes: [], bombs: [burningBomb(100, FUSE - 0.5)] });
    step({ heroes: [], explosions: [blast(100)], hits: [hit(101, 40)] });

    const row = rowFor(requireView(fold), 'A');
    expect(row?.damage).toBe(40);
    expect(row?.dps).toBeCloseTo(40 / 0.2, 6);
    expect(row?.onField).toBe(false);
  });

  it('shows a row with null Hero DPS for a hero with credit but no field time', () => {
    const { fold, step } = makeHarness();
    step({ heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    step({ heroes: [hero('A', 100)], bombs: [burningBomb(100, FUSE - 0.3)] });
    fold.reset('reset');
    step({ heroes: [], bombs: [burningBomb(100, FUSE - 0.5)] });
    step({ heroes: [], explosions: [blast(100)], hits: [hit(101, 40), hit(101, 5)], loot: [{ cell: 101, gold: 7 }] });

    const row = rowFor(requireView(fold), 'A');
    expect(row).toEqual({ heroId: 'A', dps: null, damage: 45, props: 1, gold: 7, onField: false });
  });

  it('gives a hero with neither field time nor credit no row', () => {
    const { fold, step } = makeHarness();
    step({ heroes: [hero('A'), hero('B')] });

    expect(requireView(fold).heroes).toEqual([]);
  });

  it('sorts rows by session damage descending, ties by hero id, and marks who is on the field now', () => {
    const { fold, step } = makeHarness();
    step({
      heroes: [hero('C', 10), hero('B', 20), hero('A', 30)],
      bombs: [freshBomb(10, 1.6), freshBomb(20, 1.5), freshBomb(30, 1.4)],
    });
    step({
      heroes: [hero('C', 250), hero('B', 251), hero('A', 252)],
      explosions: [blast(10), blast(20), blast(30)],
      hits: [hit(10, 50), hit(20, 70), hit(30, 50)],
    });
    step({ heroes: [hero('B', 251)] });

    const view = requireView(fold);
    expect(view.heroes.map((row) => [row.heroId, row.damage, row.onField])).toEqual([
      ['B', 70, true],
      ['A', 50, false],
      ['C', 50, false],
    ]);
  });
});

describe('DamageFold: the Unattributed row', () => {
  it('is null until the session has team damage', () => {
    const { fold, step } = makeHarness();
    step({});
    step({ loot: [{ cell: 1, gold: 10 }] });

    expect(requireView(fold).unattributed).toBeNull();
  });

  it('is present, at zero, once the session has damage and all of it was attributed', () => {
    const { fold, step } = makeHarness();
    step({ heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    step({ heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 40)] });

    const view = requireView(fold);
    expect(view.team.damage).toBe(40);
    expect(view.unattributed).toEqual({ damage: 0, props: 0, gold: 0, dps: 0 });
  });

  it('carries unattributed damage, props and gold in total and by reason', () => {
    const { fold, step } = makeHarness();
    step({ hits: [hit(10, 30)], loot: [{ cell: 10, gold: 9 }] });

    const view = requireView(fold);
    expect(view.unattributed).toEqual({ damage: 30, props: 1, gold: 9, dps: null });
    expect(view.unattributedReasons.explosionlessWithoutFantasma).toEqual({ damage: 30, props: 0, gold: 0 });
    expect(view.unattributedReasons.sharedOrUnattributedKill).toEqual({ damage: 0, props: 1, gold: 9 });
  });

  it('rates Unattributed damage over the session streamed seconds, the clock Team DPS session divides by', () => {
    const { fold, step } = makeHarness();
    step({ hits: [hit(10, 30)] });
    step({ hits: [hit(10, 30)] });
    step({});

    const view = requireView(fold);
    expect(view.sessionSeconds).toBeCloseTo(0.4, 9);
    expect(view.unattributed?.damage).toBe(60);
    expect(view.unattributed?.dps).toBeCloseTo(150, 6);
    expect(view.unattributed?.dps).toBeCloseTo(requireNumber(view.teamDpsSession), 6);
  });

  it('has no Unattributed rate on the first frame, which streams no seconds, and has one from the second', () => {
    const { fold, step } = makeHarness();
    step({ hits: [hit(10, 30)] });
    expect(requireView(fold).unattributed?.dps).toBeNull();

    step({});
    expect(requireView(fold).unattributed?.dps).toBeCloseTo(150, 6);
  });

  it('rates only the damage Unattributed alongside the hero damage that is attributed, not the team total', () => {
    const { fold, step } = makeHarness();
    step({ heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    step({ heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 40), hit(10, 20)] });
    step({ heroes: [hero('A', 100)] });

    const view = requireView(fold);
    expect(view.team.damage).toBe(60);
    expect(view.unattributed?.damage).toBe(20);
    expect(view.unattributed?.dps).toBeCloseTo(20 / 0.4, 6);
    expect(requireNumber(view.teamDpsSession)).toBeCloseTo(60 / 0.4, 6);
  });

  it('restarts the Unattributed rate on a reset: absent at once, then over only the seconds streamed since', () => {
    const { fold, step } = makeHarness();
    step({ hits: [hit(10, 30)] });
    step({});
    fold.reset('reset');
    expect(requireView(fold).unattributed).toBeNull();

    step({ hits: [hit(10, 50)] });
    expect(requireView(fold).unattributed?.dps).toBeCloseTo(50 / 0.2, 6);
    step({});
    expect(requireView(fold).unattributed?.dps).toBeCloseTo(50 / 0.4, 6);
  });
});

describe('DamageFold: prop and gold totals agree with the earnings fold', () => {
  it('counts the same props and gold, skipping loot without a valid gold the same way', () => {
    const clock = makeClock();
    const damage = new DamageFold({ now: clock.now, log: NOOP_LOG });
    const earnings = new EarningsFold({ now: clock.now, xpPerProp: () => 1, log: NOOP_LOG });
    const frames: LiveTick[] = [
      tick({ phase: 1, loot: [{ cell: 1, gold: 100 }, { cell: 2 }, { cell: 3, gold: Number.NaN }] }),
      tick({ phase: 1, loot: [{ cell: 4, gold: 50 }] }),
      tick({ phase: 1 }),
      tick({ phase: 1, loot: [{ cell: 5, gold: 0 }] }),
    ];
    frames.forEach((frame, index) => {
      clock.advance(FRAME_MS);
      damage.consumeTick(frame, index + 1);
      earnings.consumeTick(frame, index + 1, undefined);
      expectReconciled(damage.view);
    });

    const view = requireView(damage);
    expect(view.team.props).toBe(earnings.propsSessionTotal);
    expect(view.team.gold).toBe(earnings.goldSessionTotal);
    expect(view.team.props).toBe(3);
    expect(view.team.gold).toBe(150);
  });
});

describe('DamageFold: continuity flag passed to the engine', () => {
  function discontinuousFlags(gaps: readonly number[]): readonly boolean[] {
    const { attributor, seen } = fakeAttributor(() => creditOf());
    const { step } = makeHarness({ attributor });
    for (const gap of gaps) step({}, gap);
    return seen.options.map((options) => options.discontinuous);
  }

  it('marks no frame discontinuous at the regular cadence, the first frame included', () => {
    expect(discontinuousFlags([FRAME_MS, FRAME_MS, 100])).toEqual([false, false, false]);
  });

  it('marks a frame discontinuous only when the wall gap since the previous frame exceeds the limit', () => {
    expect(discontinuousFlags([200, 400, 401, 200])).toEqual([false, false, true, false]);
  });

  it('a 400 ms wall gap is not discontinuous and a 401 ms gap is, whatever the exported limit says', () => {
    expect(discontinuousFlags([200, 400])).toEqual([false, false]);
    expect(discontinuousFlags([200, 401])).toEqual([false, true]);
  });
});

describe('DamageFold: an engine failure', () => {
  function failingSecondFrame() {
    const { attributor, seen } = fakeAttributor((call) => {
      if (call === 2) throw new Error('unforeseen shape');
      return creditOf({
        team: { damage: 10, props: 0, gold: 0 },
        perHero: new Map([['A', { damage: 10, props: 0, gold: 0 }]]),
        present: ['A'],
      });
    });
    const logged = recordingLog();
    const harness = makeHarness({ attributor, log: logged.log });
    return { ...harness, seen, logged };
  }

  it('adds nothing for the failed frame to the team or to any hero, and still advances the clock', () => {
    const { fold, step } = failingSecondFrame();
    step({ heroes: [hero('A')] });
    const before = requireView(fold);
    step({ heroes: [hero('A')] });
    const after = requireView(fold);

    expect(after.team).toEqual(before.team);
    expect(rowFor(after, 'A')?.damage).toBe(rowFor(before, 'A')?.damage);
    expect(after.sessionSeconds).toBeCloseTo(before.sessionSeconds + 0.2, 9);
  });

  it('counts none of the failed frame\'s own hits and loot, in the team, the hero rows or Unattributed', () => {
    const { fold, step } = failingSecondFrame();
    step({ heroes: [hero('A')] });
    const before = requireView(fold);
    step({ heroes: [hero('A')], hits: [hit(1, 999)], loot: [{ cell: 1, gold: 77 }] });
    const after = requireView(fold);

    expect(after.team).toEqual(before.team);
    expect(after.heroes.map((row) => [row.heroId, row.damage, row.props, row.gold])).toEqual(
      before.heroes.map((row) => [row.heroId, row.damage, row.props, row.gold]),
    );
    expect(after.unattributedReasons).toEqual(before.unattributedReasons);
  });

  it('still gives the heroes in the failed frame\'s list that frame\'s streamed seconds', () => {
    const { fold, step } = failingSecondFrame();
    step({ heroes: [hero('A')] });
    expect(rowFor(requireView(fold), 'A')?.dps).toBeNull();

    step({ heroes: [hero('A')], hits: [hit(1, 999)] });

    expect(rowFor(requireView(fold), 'A')?.dps).toBeCloseTo(10 / 0.2, 6);
  });

  it('forgets the live bombs and marks the next frame discontinuous, then recovers', () => {
    const { step, seen } = failingSecondFrame();
    step({ heroes: [hero('A')] });
    step({ heroes: [hero('A')] });
    step({ heroes: [hero('A')] });
    step({ heroes: [hero('A')] });

    expect(seen.forgotten).toBe(1);
    expect(seen.options.map((options) => options.discontinuous)).toEqual([false, false, true, false]);
  });

  it('logs the failure once per session, and again after a reset', () => {
    const { attributor } = fakeAttributor(() => {
      throw new Error('always');
    });
    const logged = recordingLog();
    const { fold, step } = makeHarness({ attributor, log: logged.log });
    step({});
    step({});
    step({});
    expect(logged.eventsOf('live_damage.frame_failed')).toHaveLength(1);

    fold.reset('reset');
    step({});
    expect(logged.eventsOf('live_damage.frame_failed')).toHaveLength(2);
  });
});

describe('DamageFold: reset and account change', () => {
  it('zeroes the session figures and field seconds on reset while the 10-minute window keeps rolling', () => {
    const { fold, step } = makeHarness();
    step({ heroes: [hero('A', 100)], bombs: [freshBomb(100)] });
    step({ heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 40)] });
    step({ heroes: [hero('A', 100)] });
    const before = requireView(fold);
    expect(before.teamDps10).toBeGreaterThan(0);

    fold.reset('reset');

    const after = requireView(fold);
    expect(after.team).toEqual({ damage: 0, props: 0, gold: 0 });
    expect(after.sessionSeconds).toBe(0);
    expect(after.teamDpsSession).toBeNull();
    expect(after.heroes).toEqual([]);
    expect(after.unattributed).toBeNull();
    for (const reason of ALL_REASONS) expect(after.unattributedReasons[reason]).toEqual({ damage: 0, props: 0, gold: 0 });
    expect(after.teamDps10).toBe(before.teamDps10);
    expect(after.coverageSeconds).toBe(before.coverageSeconds);
  });

  function learnFingerprintThenLoseSight(trigger: 'reset' | 'accountChange') {
    const { fold, step } = makeHarness();
    step({ heroes: [hero('A', 100)], bombs: [freshBomb(100, 1.7)] });
    step({ heroes: [hero('A', 100)], explosions: [blast(100)], hits: [hit(101, 10)] });
    fold.reset(trigger);
    step({ heroes: [hero('A', 3)], bombs: [freshBomb(50, 1.7)] });
    step({ heroes: [hero('A', 3)], explosions: [blast(50)], hits: [hit(51, 25)] });
    return requireView(fold);
  }

  it('keeps learned fingerprints and signatures across a reset: a later bomb is owned by its fingerprint alone', () => {
    const view = learnFingerprintThenLoseSight('reset');

    expect(rowFor(view, 'A')?.damage).toBe(25);
    expect(view.unattributed).toEqual({ damage: 0, props: 0, gold: 0, dps: 0 });
  });

  it('forgets learned fingerprints on an account change: the same later bomb has no owner', () => {
    const view = learnFingerprintThenLoseSight('accountChange');

    expect(rowFor(view, 'A')?.damage ?? 0).toBe(0);
    expect(view.unattributedReasons.noOwnerAtBirth.damage).toBe(25);
  });

  it('clears both windows and the attributor on an account change', () => {
    const ownerless = { damage: 10, props: 0, gold: 0 };
    const { attributor, seen } = fakeAttributor(() =>
      creditOf({
        team: ownerless,
        unattributed: { ...creditOf().unattributed, noOwnerAtBirth: ownerless },
      }),
    );
    const { fold, step } = makeHarness({ attributor });
    step({});
    step({});
    expect(requireView(fold).teamDps10).not.toBeNull();

    fold.reset('accountChange');

    const view = requireView(fold);
    expect(seen.cleared).toBe(1);
    expect(view.teamDps10).toBeNull();
    expect(view.coverageSeconds).toBe(0);
    expect(view.sessionSeconds).toBe(0);
    expect(view.team.damage).toBe(0);
  });

  it('does not clear the attributor on a plain reset', () => {
    const { attributor, seen } = fakeAttributor(() => creditOf());
    const { fold, step } = makeHarness({ attributor });
    step({});
    fold.reset('reset');

    expect(seen.cleared).toBe(0);
  });

  it('empties who is on the field on an account change but not on a reset', () => {
    const { fold, step } = makeHarness();
    step({ heroes: [hero('A')] });
    step({ heroes: [hero('A')] });
    fold.reset('reset');
    step({ heroes: [hero('A')] });
    expect(rowFor(requireView(fold), 'A')?.onField).toBe(true);

    fold.reset('accountChange');
    expect(requireView(fold).heroes).toEqual([]);
  });
});

describe('DamageFold: roster facts', () => {
  const RAW_ROSTER = [
    { id: 'A', stats: { cooldown_reduction: 0.2 }, abilities: [{ code: 'fantasma', level: 2 }] },
    { id: 'B', stats: { cooldown_reduction: 0.5 }, abilities: [] },
    'not a hero',
  ];

  it('reads the raw roster into combat facts for the engine', () => {
    const { attributor, seen } = fakeAttributor(() => creditOf());
    const { fold } = makeHarness({ attributor });
    fold.setRoster(RAW_ROSTER);

    expect(seen.rosters).toEqual([
      [
        { id: 'A', cooldownReduction: 0.2, carriesFantasma: true },
        { id: 'B', cooldownReduction: 0.5, carriesFantasma: false },
      ],
    ]);
  });

  it('seeds fingerprints: a bomb is owned by its hero\'s fuse total even with nobody on its cell', () => {
    const { fold, step } = makeHarness();
    fold.setRoster(RAW_ROSTER);
    step({ heroes: [hero('A', 3), hero('B', 4)], bombs: [freshBomb(50, 1.6)] });
    step({ heroes: [hero('A', 3), hero('B', 4)], explosions: [blast(50)], hits: [hit(51, 25)] });

    expect(rowFor(requireView(fold), 'A')?.damage).toBe(25);
  });

  it('credits a plain hit with no blast to a Fantasma carrier standing on its cell', () => {
    const { fold, step } = makeHarness();
    fold.setRoster(RAW_ROSTER);
    step({ heroes: [hero('A', 7), hero('B', 8)] });
    step({ heroes: [hero('A', 7), hero('B', 8)], hits: [hit(7, 60)] });

    expect(rowFor(requireView(fold), 'A')?.damage).toBe(60);
  });
});

describe('DamageFold: diagnostics logs', () => {
  it('logs a fingerprint disagreement once per hero per account', () => {
    const disagreement: FingerprintDisagreement = { heroId: 'A', seeded: 1.6, learned: 1.5 };
    const { attributor } = fakeAttributor(() => creditOf({ disagreements: [disagreement] }));
    const logged = recordingLog();
    const { fold, step } = makeHarness({ attributor, log: logged.log });
    step({});
    step({});
    fold.reset('reset');
    step({});
    expect(logged.eventsOf('live_damage.fingerprint_disagreement')).toHaveLength(1);
    expect(logged.eventsOf('live_damage.fingerprint_disagreement')[0]).toMatchObject({ heroId: 'A', seeded: 1.6, learned: 1.5 });

    fold.reset('accountChange');
    step({});
    expect(logged.eventsOf('live_damage.fingerprint_disagreement')).toHaveLength(2);
  });

  it('logs each Unattributed reason once per session, when its first amount appears', () => {
    const logged = recordingLog();
    const { fold, step } = makeHarness({ log: logged.log });
    step({});
    expect(logged.eventsOf('live_damage.unattributed_reason')).toHaveLength(0);

    step({ hits: [hit(10, 5)] });
    step({ hits: [hit(10, 5)] });
    expect(logged.eventsOf('live_damage.unattributed_reason')).toEqual([
      { scope: 'live-source', event: 'live_damage.unattributed_reason', reason: 'explosionlessWithoutFantasma' },
    ]);

    step({ loot: [{ cell: 10, gold: 3 }] });
    expect(logged.eventsOf('live_damage.unattributed_reason').map((record) => record.reason)).toEqual([
      'explosionlessWithoutFantasma',
      'noHitOnLootCell',
    ]);

    fold.reset('reset');
    step({ hits: [hit(10, 5)] });
    expect(logged.eventsOf('live_damage.unattributed_reason')).toHaveLength(3);
  });
});

describe('DamageFold: reconciliation on a mixed stream', () => {
  it('holds after every frame across owned, overlapping, ghost, shard and loot credit', () => {
    const { fold, step } = makeHarness();
    fold.setRoster([
      { id: 'A', stats: { cooldown_reduction: 0.2 }, abilities: [] },
      { id: 'G', stats: { cooldown_reduction: 0.1 }, abilities: [{ code: 'fantasma', level: 1 }] },
    ]);
    const heroes = [hero('A', 20), hero('G', 40)];
    step({ heroes, bombs: [freshBomb(20), freshBomb(22)] });
    step({
      heroes,
      explosions: [blast(20), blast(22)],
      hits: [hit(21, 10), hit(40, 7), hit(41, 3, { shardOrigin: 20 }), hit(99, 4, { secondBlast: true })],
      loot: [{ cell: 21, gold: 5 }, { cell: 99, gold: 6 }, { cell: 0 }],
    });
    step({ heroes, hits: [hit(40, 9)], loot: [{ cell: 40, gold: 8 }] });

    const view = requireView(fold);
    expect(view.team.damage).toBe(33);
    expect(view.team.props).toBe(3);
    expect(view.team.gold).toBe(19);
  });
});

const COMBAT_FIXTURE = resolve(__dirname, 'fixtures', 'live-capture-combat.bfcc');
const COMBAT_ROSTER = resolve(__dirname, 'fixtures', 'live-capture-combat.roster.json');
const TODAYS_FIXTURE = resolve(__dirname, 'fixtures', 'live-capture.bfcc');

function replayTicks(path: string): readonly LiveTick[] {
  const conn = new TlsConnections();
  const events: TapEvent[] = [];
  for (const record of readCaptureRecords(readFileSync(path))) events.push(...conn.push(record.ctx, record.bytes));
  return events.flatMap((event) => (event.kind === 'tick' ? [event.tick] : []));
}

function rawRosterFromSidecar(): unknown[] {
  const facts = JSON.parse(readFileSync(COMBAT_ROSTER, 'utf8')) as RosterCombatFact[];
  return facts.map((fact) => ({
    id: fact.id,
    stats: { cooldown_reduction: fact.cooldownReduction },
    abilities: fact.carriesFantasma ? [{ code: 'fantasma', level: 1 }] : [],
  }));
}

function replayThroughFold(ticks: readonly LiveTick[], rawRoster: readonly unknown[] | null) {
  const credits: FrameCredit[] = [];
  const inner = createLiveDamageAttributor();
  const recording: LiveDamageAttributor = {
    setRoster: (facts) => {
      inner.setRoster(facts);
    },
    consume: (frame, options) => {
      const credit = inner.consume(frame, options);
      credits.push(credit);
      return credit;
    },
    clear: () => {
      inner.clear();
    },
    forgetLiveBombs: () => {
      inner.forgetLiveBombs();
    },
  };
  const clock = makeClock();
  const warn = vi.fn();
  const fold = new DamageFold({ now: clock.now, log: { info: () => undefined, warn }, attributor: recording });
  if (rawRoster !== null) fold.setRoster(rawRoster);
  ticks.forEach((frame, index) => {
    clock.advance(FRAME_MS);
    fold.consumeTick(frame, index + 1);
    expectReconciled(fold.view);
  });
  return { fold, credits, warn };
}

describe('DamageFold: replaying the combat capture', () => {
  const ticks = replayTicks(COMBAT_FIXTURE);
  const { fold, credits, warn } = replayThroughFold(ticks, rawRosterFromSidecar());
  const view = requireView(fold);

  const sum = (pick: (credit: FrameCredit) => number): number => credits.reduce((total, credit) => total + pick(credit), 0);

  it('replays all 601 frames through the engine without a failure', () => {
    expect(ticks).toHaveLength(601);
    expect(credits).toHaveLength(601);
    expect(warn).not.toHaveBeenCalled();
  });

  it('owns every fresh Birth, with seven adopted bombs and no cell-owner conflict', () => {
    expect(sum((credit) => credit.bombs.births)).toBe(328);
    expect(sum((credit) => credit.bombs.owned)).toBe(328);
    expect(sum((credit) => credit.bombs.adopted)).toBe(7);
    expect(sum((credit) => credit.bombs.cellOwnerConflicts)).toBe(0);
  });

  it('attributes 967 of 972 hits, above the 97% bar', () => {
    const total = sum((credit) => credit.hits.total);
    const attributed = sum((credit) => credit.hits.attributed);
    expect(total).toBe(972);
    expect(attributed).toBe(967);
    expect(attributed / total).toBeGreaterThanOrEqual(0.97);
  });

  it('folds session team damage, props and gold to the pinned totals', () => {
    expect(view.team).toEqual({ damage: 2_633_742_676, props: 635, gold: 13_143_669 });
  });

  it('puts only the unresolved overlap damage and one shared kill in Unattributed', () => {
    const expected: Record<UnattributedReason, CreditAmounts> = {
      noOwnerAtBirth: { damage: 0, props: 0, gold: 0 },
      explosionWithoutBomb: { damage: 0, props: 0, gold: 0 },
      streamDiscontinuity: { damage: 0, props: 0, gold: 0 },
      unresolvedOverlap: { damage: 2_373_305, props: 0, gold: 0 },
      explosionlessWithoutFantasma: { damage: 0, props: 0, gold: 0 },
      sharedOrUnattributedKill: { damage: 0, props: 6, gold: 129_662 },
      noHitOnLootCell: { damage: 0, props: 0, gold: 0 },
    };
    expect(view.unattributedReasons).toEqual(expected);
    expect(view.sessionSeconds).toBeCloseTo(120, 6);
    expect(view.unattributed).toMatchObject({ damage: 2_373_305, props: 6, gold: 129_662 });
    expect(view.unattributed?.dps).toBeCloseTo(2_373_305 / 120, 6);
  });

  it('gives twelve distinct heroes a row, and their figures plus Unattributed add up to the team', () => {
    expect(view.heroes).toHaveLength(12);
    expect(new Set(view.heroes.map((row) => row.heroId)).size).toBe(12);
    expectReconciled(view);
  });
});

describe('DamageFold: replaying the committed live capture', () => {
  it('replays without a failure and reconciles after every frame', () => {
    const ticks = replayTicks(TODAYS_FIXTURE);
    const { fold, warn } = replayThroughFold(ticks, null);

    expect(ticks.length).toBeGreaterThan(0);
    expect(warn).not.toHaveBeenCalled();
    expectReconciled(fold.view);
  });
});
