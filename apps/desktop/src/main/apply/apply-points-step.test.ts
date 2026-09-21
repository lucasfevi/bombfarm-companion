import { describe, expect, it } from 'vitest';
import type { ApplyPointsUnit, ApplyStopReason } from '@bombfarm/contracts';
import { pointsToCommitVector } from '@bombfarm/domain/team-plan';
import { WRITE_ROUTES, type HeroDetailReading, type WriteCall } from '@bombfarm/game-api';
import type { ApplyCallVerdict } from './apply-outcome.js';
import type { ApplyRunContext } from './apply-run-context.js';
import { runPointsUnit } from './apply-points-step.js';

const ZERO = { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };
const BEFORE = { ...ZERO, attack: 44 };
const TARGET = { ...ZERO, critChance: 56 };

const UNIT: ApplyPointsUnit = {
  index: 0,
  heroId: 'h7',
  level: 30,
  needsRespec: true,
  respecGold: 30_000,
  vectorBefore: pointsToCommitVector(BEFORE),
  vector: pointsToCommitVector(TARGET),
  pointsPlaced: 56,
};

type CallAnswer = ApplyCallVerdict | { kind: 'stop'; stop: Exclude<ApplyStopReason, 'finished'>; code: null };

function fakeContext(opts: { reading: HeroDetailReading | 'paused-out'; calls?: CallAnswer[]; wallet?: number | null }) {
  const script = [...(opts.calls ?? [])];
  const recordedCalls: { kind: string; writeCall: WriteCall }[] = [];
  const ctx: ApplyRunContext = {
    call: (kind, writeCall) => {
      recordedCalls.push({ kind, writeCall });
      const next = script.shift();
      if (!next) throw new Error(`no scripted call answer for call #${String(recordedCalls.length)}`);
      return Promise.resolve(next);
    },
    readDetail: () => Promise.resolve(opts.reading),
    wallet: () => opts.wallet ?? 1_000_000,
  };
  return { ctx, recordedCalls };
}

function okReading(alloc = BEFORE, spent = 44, respecGold: number | null = 30_000): Extract<HeroDetailReading, { kind: 'ok' }> {
  return { kind: 'ok', alloc: pointsToCommitVector(alloc), spent, available: null, respecGold };
}

describe('runPointsUnit — pendingFull', () => {
  it('sends respec then commit in order, and reports the server-quoted gold', async () => {
    const { ctx, recordedCalls } = fakeContext({ reading: okReading(), calls: [{ kind: 'ok' }, { kind: 'ok' }] });
    const result = await runPointsUnit(UNIT, ctx);
    expect(recordedCalls).toEqual([
      { kind: 'respec', writeCall: { route: WRITE_ROUTES.respec, hero: 'h7' } },
      { kind: 'commit', writeCall: { route: WRITE_ROUTES.commit, hero: 'h7', points: UNIT.vector } },
    ]);
    expect(result).toEqual({ kind: 'ok', goldSpent: 30_000 });
  });

  it('falls back to the unit\'s own respec cost when the reading carries none', async () => {
    const { ctx } = fakeContext({ reading: okReading(BEFORE, 44, null), calls: [{ kind: 'ok' }, { kind: 'ok' }] });
    const result = await runPointsUnit(UNIT, ctx);
    expect(result).toEqual({ kind: 'ok', goldSpent: UNIT.respecGold });
  });

  it('skips notEnoughGold before any call when the wallet is short', async () => {
    const { ctx, recordedCalls } = fakeContext({ reading: okReading(), wallet: 100 });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'skip', reason: 'notEnoughGold' });
    expect(recordedCalls).toHaveLength(0);
  });

  it('skips no wallet check when the wallet is unknown', async () => {
    const { ctx, recordedCalls } = fakeContext({ reading: okReading(), wallet: null, calls: [{ kind: 'ok' }, { kind: 'ok' }] });
    await runPointsUnit(UNIT, ctx);
    expect(recordedCalls).toHaveLength(2);
  });
});

describe('runPointsUnit — pendingCommit (already reset)', () => {
  const PENDING_COMMIT_READING = okReading(ZERO, 0);

  it('sends only commit, with no gold spent', async () => {
    const { ctx, recordedCalls } = fakeContext({ reading: PENDING_COMMIT_READING, calls: [{ kind: 'ok' }] });
    const result = await runPointsUnit(UNIT, ctx);
    expect(recordedCalls).toEqual([{ kind: 'commit', writeCall: { route: WRITE_ROUTES.commit, hero: 'h7', points: UNIT.vector } }]);
    expect(result).toEqual({ kind: 'ok', goldSpent: 0 });
  });
});

describe('runPointsUnit — preflight verdicts that skip before any call', () => {
  it('done (the live allocation already matches the target) skips alreadyDone', async () => {
    const { ctx, recordedCalls } = fakeContext({ reading: okReading(TARGET, 56) });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'skip', reason: 'alreadyDone' });
    expect(recordedCalls).toHaveLength(0);
  });

  it('conflict (the live allocation is neither before nor the target) skips allocationChanged', async () => {
    const { ctx, recordedCalls } = fakeContext({ reading: okReading({ ...ZERO, speed: 12 }, 12) });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'skip', reason: 'allocationChanged' });
    expect(recordedCalls).toHaveLength(0);
  });
});

describe('runPointsUnit — a commit answered after a respec', () => {
  it('a skip-class outcome on commit is reported as resetNotPlaced, carrying the outcome\'s code', async () => {
    const { ctx } = fakeContext({
      reading: okReading(),
      calls: [{ kind: 'ok' }, { kind: 'skip', reason: 'heroMissing' }],
    });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'skip', reason: 'resetNotPlaced', code: undefined });
  });

  it('a stop-class outcome on commit fails the unit with resetDone true', async () => {
    const { ctx } = fakeContext({
      reading: okReading(),
      calls: [{ kind: 'ok' }, { kind: 'stop', stop: 'network', code: null }],
    });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'network', code: null, call: 'commit', resetDone: true });
  });

  it('a respec that itself stops never reaches commit, and resetDone is false', async () => {
    const { ctx, recordedCalls } = fakeContext({
      reading: okReading(),
      calls: [{ kind: 'stop', stop: 'unauthorized', code: null }],
    });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'unauthorized', code: null, call: 'respec', resetDone: false });
    expect(recordedCalls).toHaveLength(1);
  });
});

describe('runPointsUnit — reading failures', () => {
  it('unauthorized stops unauthorized before any call', async () => {
    const { ctx, recordedCalls } = fakeContext({ reading: { kind: 'failed', reason: 'unauthorized', code: 'NO_TOKEN' } });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'unauthorized', code: 'NO_TOKEN', call: null, resetDone: false });
    expect(recordedCalls).toHaveLength(0);
  });

  it('a transport error stops network', async () => {
    const { ctx } = fakeContext({ reading: { kind: 'failed', reason: 'transport_error' } });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'network', code: null, call: null, resetDone: false });
  });

  it('a 5xx http_error stops network', async () => {
    const { ctx } = fakeContext({ reading: { kind: 'failed', reason: 'http_error', status: 500 } });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'network', code: null, call: null, resetDone: false });
  });

  it('malformed JSON stops network', async () => {
    const { ctx } = fakeContext({ reading: { kind: 'failed', reason: 'malformed_json' } });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'network', code: null, call: null, resetDone: false });
  });

  it('too_large stops network', async () => {
    const { ctx } = fakeContext({ reading: { kind: 'failed', reason: 'too_large' } });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'network', code: null, call: null, resetDone: false });
  });

  it('bad_shape stops network', async () => {
    const { ctx } = fakeContext({ reading: { kind: 'failed', reason: 'bad_shape' } });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'network', code: null, call: null, resetDone: false });
  });

  it('api_error NO_SUCH_HERO skips heroMissing', async () => {
    const { ctx } = fakeContext({ reading: { kind: 'failed', reason: 'api_error', code: 'NO_SUCH_HERO' } });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'skip', reason: 'heroMissing', code: 'NO_SUCH_HERO' });
  });

  it('http_error 404 skips heroMissing', async () => {
    const { ctx } = fakeContext({ reading: { kind: 'failed', reason: 'http_error', status: 404 } });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'skip', reason: 'heroMissing' });
  });

  it('any other api_error stops refused, carrying its code', async () => {
    const { ctx } = fakeContext({ reading: { kind: 'failed', reason: 'api_error', code: 'SERVER_LOCKED' } });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'refused', code: 'SERVER_LOCKED', call: null, resetDone: false });
  });

  it("a 'paused-out' reading (Stop pressed during the read's cooldown) stops the run stopped", async () => {
    const { ctx, recordedCalls } = fakeContext({ reading: 'paused-out' });
    expect(await runPointsUnit(UNIT, ctx)).toEqual({ kind: 'stop', stop: 'stopped', code: null, call: null, resetDone: false });
    expect(recordedCalls).toHaveLength(0);
  });
});
