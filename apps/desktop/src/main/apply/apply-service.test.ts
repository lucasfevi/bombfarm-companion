import { describe, expect, it } from 'vitest';
import type { ApplyEquipUnit, ApplyEvent, ApplyPointsUnit, ApplyStartRequest } from '@bombfarm/contracts';
import { pointsToCommitVector } from '@bombfarm/domain/team-plan';
import {
  SessionToken,
  createPacingGate,
  type ConsentRecord,
  type HttpResponse,
  type HttpTransport,
  type PacingGate,
} from '@bombfarm/game-api';
import { consentRecord, grantedConsent } from '@bombfarm/game-api/test-fixtures';
import { createWriterLock, type WriterLock } from './writer-lock.js';
import { createApplyService, type ApplyServiceDeps } from './apply-service.js';

const GRANTED = grantedConsent('2026-09-20T10:00:00.000Z');
const NOOP_LOG = { info: () => undefined, warn: () => undefined, error: () => undefined };
const READ_OK = { ok: true } as const;

type Reply = { readonly status: number; readonly body: string; readonly hold?: boolean };

function ok(body: unknown = {}): Reply {
  return { status: 200, body: JSON.stringify(body) };
}
function apiError(code: string, status = 409): Reply {
  return { status, body: JSON.stringify({ error: code }) };
}
function plainHttpError(status: number): Reply {
  return { status, body: 'nope' };
}
function heroDetailOk(alloc: number[], spent = 0, respecGold: number | null = 30_000): Reply {
  return ok({ alloc, stat_points_spent: spent, respec_gold_cost: respecGold });
}

function scriptedTransport(script: Reply[]) {
  const requests: { path: string }[] = [];
  const pending: (() => void)[] = [];
  const transport: HttpTransport = (req) => {
    requests.push({ path: req.path });
    const reply = script.shift();
    if (!reply) throw new Error(`no scripted reply for call ${String(requests.length)}`);
    const response: HttpResponse = { status: reply.status, body: reply.body };
    if (reply.hold !== true) return Promise.resolve(response);
    return new Promise((resolve) => {
      pending.push(() => {
        resolve(response);
      });
    });
  };
  return {
    transport,
    requests,
    release() {
      for (const settle of pending.splice(0)) settle();
    },
    pendingCount: () => pending.length,
  };
}

function requestIdOf(path: string): string | null {
  return new URLSearchParams(path.split('?')[1] ?? '').get('request_id');
}

function immediateGate(): PacingGate {
  return createPacingGate({ now: () => 0, sleep: () => Promise.resolve() });
}

function equipUnit(index: number, overrides: Partial<ApplyEquipUnit> = {}): ApplyEquipUnit {
  return {
    index,
    call: 'equip',
    itemId: `g${String(index)}`,
    defId: 'def',
    slot: '1',
    fromHeroId: null,
    toHeroId: `h${String(index)}`,
    displacesItemId: null,
    freedByIndex: null,
    pendingAt: [null],
    doneAt: [`h${String(index)}`],
    ...overrides,
  };
}

function itemRow(id: string, wearer: string | null) {
  return { id, equipped_on: wearer };
}
function heroRow(id: string) {
  return { id };
}

const ZERO = { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };
const BEFORE_STATS = { ...ZERO, attack: 44 };
const TARGET_STATS = { ...ZERO, critChance: 56 };

function pointsUnit(overrides: Partial<ApplyPointsUnit> = {}): ApplyPointsUnit {
  return {
    index: 0,
    heroId: 'h7',
    level: 30,
    needsRespec: true,
    respecGold: 30_000,
    vectorBefore: pointsToCommitVector(BEFORE_STATS),
    vector: pointsToCommitVector(TARGET_STATS),
    pointsPlaced: 56,
    ...overrides,
  };
}

function harness(
  overrides: Partial<ApplyServiceDeps> & { script?: Reply[]; consent?: ConsentRecord; writerLock?: WriterLock } = {},
) {
  const wire = scriptedTransport(overrides.script ?? []);
  const events: ApplyEvent[] = [];
  const sleeps: number[] = [];
  const reads: number[] = [];
  const gate = overrides.gate ?? immediateGate();
  const writerLock = overrides.writerLock ?? createWriterLock();
  let clock = 1_000;
  const deps: ApplyServiceDeps = {
    consentStore: { read: () => overrides.consent ?? GRANTED },
    readToken: () => ({ ok: true, accountId: '486', token: SessionToken.create('sentinel-apply-do-not-leak'), mtimeMs: 1 }),
    settings: () => ({ forgeWritesEnabled: true }),
    transport: wire.transport,
    gate,
    accountSource: () => 'server',
    isGameRunning: () => true,
    currentItems: () => [itemRow('g0', null)],
    currentHeroes: () => [heroRow('h0')],
    currentGold: () => 1_000_000,
    writerLock,
    requestReadNow: () => {
      reads.push(1);
      return READ_OK;
    },
    emit: (event) => {
      events.push(event);
    },
    log: NOOP_LOG,
    now: () => (clock += 10),
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    random: () => 0.5,
    ...overrides,
  };
  const service = createApplyService(deps);
  return { service, wire, events, sleeps, gate, writerLock, reads };
}

async function untilDone(events: ApplyEvent[]): Promise<Extract<ApplyEvent, { type: 'done' }>> {
  for (let spin = 0; spin < 200; spin++) {
    const done = events.find((event): event is Extract<ApplyEvent, { type: 'done' }> => event.type === 'done');
    if (done) return done;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('the run never finished');
}

function equipRequest(units: ApplyEquipUnit[]): ApplyStartRequest {
  return { step: 'equip', planRunId: 'plan-1', units };
}
function pointsRequest(units: ApplyPointsUnit[]): ApplyStartRequest {
  return { step: 'points', planRunId: 'plan-1', units };
}

describe('start refusals', () => {
  it('answers busy when the forge holds the writer lock, and sends nothing', () => {
    const lock = createWriterLock();
    lock.acquire('forge');
    const h = harness({ writerLock: lock, script: [ok()] });
    expect(h.service.start(equipRequest([equipUnit(0)]))).toEqual({ ok: false, reason: 'busy' });
    expect(h.wire.requests).toHaveLength(0);
  });

  it('answers busy on a second start while a run is already active', async () => {
    const h = harness({ script: [{ ...ok(), hold: true }] });
    const started = h.service.start(equipRequest([equipUnit(0)]));
    expect(started.ok).toBe(true);
    expect(h.service.start(equipRequest([equipUnit(0)]))).toEqual({ ok: false, reason: 'busy' });
    for (let spin = 0; spin < 50 && h.wire.pendingCount() === 0; spin++) await new Promise((resolve) => setImmediate(resolve));
    h.wire.release();
    await untilDone(h.events);
  });

  const REFUSAL_CASES: [string, Partial<ApplyServiceDeps> & { consent?: ConsentRecord }, unknown, string][] = [
    ['bad_request', {}, { not: 'a valid request' }, 'bad_request'],
    ['offline', { accountSource: () => 'fixture' }, equipRequest([equipUnit(0)]), 'offline'],
    ['not_consented', { consent: consentRecord({ decision: 'declined' }) }, equipRequest([equipUnit(0)]), 'not_consented'],
    ['game_not_running', { isGameRunning: () => false }, equipRequest([equipUnit(0)]), 'game_not_running'],
    ['token_unavailable', { readToken: () => ({ ok: false, reason: 'not_found' }) }, equipRequest([equipUnit(0)]), 'token_unavailable'],
    ['writes_disabled', { settings: () => ({ forgeWritesEnabled: false }) }, equipRequest([equipUnit(0)]), 'writes_disabled'],
    ['nothing_to_apply (no cache rows)', { currentItems: () => null, currentHeroes: () => null }, equipRequest([equipUnit(0)]), 'nothing_to_apply'],
    [
      'nothing_to_apply (every unit already done)',
      { currentItems: () => [itemRow('g0', 'h0')], currentHeroes: () => [heroRow('h0')] },
      equipRequest([equipUnit(0)]),
      'nothing_to_apply',
    ],
  ];

  it.each(REFUSAL_CASES)('%s — refuses, sends nothing, holds no lock', (_label, overrides, request, reason) => {
    const h = harness({ ...overrides, script: [ok()] });
    expect(h.service.start(request)).toEqual({ ok: false, reason });
    expect(h.wire.requests).toHaveLength(0);
    expect(h.writerLock.holder).toBeNull();
    expect(h.service.isRunning()).toBe(false);
  });
});

describe('equip step', () => {
  it('runs the five-unit script from the spec: three succeed, one hits a named refusal, one is missing from the cache', async () => {
    const units = [
      equipUnit(0),
      equipUnit(1), // g1 absent from the cache -> itemMissing, no call
      equipUnit(2),
      equipUnit(3), // server answers HERO_LEVEL_TOO_LOW
      equipUnit(4),
    ];
    const h = harness({
      currentItems: () => [itemRow('g0', null), itemRow('g2', null), itemRow('g3', null), itemRow('g4', null)],
      currentHeroes: () => [heroRow('h0'), heroRow('h1'), heroRow('h2'), heroRow('h3'), heroRow('h4')],
      script: [ok(), ok(), apiError('HERO_LEVEL_TOO_LOW'), ok()],
    });
    h.service.start(equipRequest(units));
    const done = await untilDone(h.events);

    expect(h.wire.requests).toHaveLength(4);
    expect(
      h.events.filter((e): e is Extract<ApplyEvent, { type: 'unit' }> => e.type === 'unit').map((e) => [e.index, e.status, e.reason]),
    ).toEqual([
      [0, 'sent', undefined],
      [0, 'ok', undefined],
      [1, 'skipped', 'itemMissing'],
      [2, 'sent', undefined],
      [2, 'ok', undefined],
      [3, 'sent', undefined],
      [3, 'skipped', 'heroLevel'],
      [4, 'sent', undefined],
      [4, 'ok', undefined],
    ]);
    expect(done.result).toMatchObject({
      made: 3,
      skipped: [
        { index: 1, reason: 'itemMissing' },
        { index: 3, reason: 'heroLevel', code: 'HERO_LEVEL_TOO_LOW' },
      ],
      stop: 'finished',
    });
    expect(h.events.at(-1)?.type).toBe('done');
  });

  it('a unit the cache already shows in place skips alreadyDone, with no call', async () => {
    // A lone already-done unit would itself make the whole start `nothing_to_apply`, so a genuinely
    // pending sibling unit rides along to keep the run alive and prove the skip happens mid-run.
    const units = [equipUnit(0, { toHeroId: 'h0', doneAt: ['h0'] }), equipUnit(1)];
    const h = harness({
      currentItems: () => [itemRow('g0', 'h0'), itemRow('g1', null)],
      currentHeroes: () => [heroRow('h0'), heroRow('h1')],
      script: [ok()],
    });
    h.service.start(equipRequest(units));
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(1);
    expect(done.result).toMatchObject({
      made: 1,
      skipped: [{ index: 0, reason: 'alreadyDone' }],
      stop: 'finished',
    });
  });

  it('a unit whose freeing unit was skipped this run, and whose piece still sits on a third hero, skips itemMoved with no call', async () => {
    const units = [
      equipUnit(0), // g0 absent from cache -> itemMissing (skipped)
      equipUnit(1, { freedByIndex: 0 }), // g1 still worn by hOther, not h1
      equipUnit(2), // a genuinely pending unit, so the start is not refused nothing_to_apply
    ];
    const h = harness({
      currentItems: () => [itemRow('g1', 'hOther'), itemRow('g2', null)],
      currentHeroes: () => [heroRow('h0'), heroRow('h1'), heroRow('h2'), heroRow('hOther')],
      script: [ok()],
    });
    h.service.start(equipRequest(units));
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(1);
    expect(done.result.skipped).toEqual([
      { index: 0, reason: 'itemMissing' },
      { index: 1, reason: 'itemMoved' },
    ]);
    expect(done.result.made).toBe(1);
  });

  it('a preflight skip (no call ever made) carries no code, unlike a server-answered skip', async () => {
    const h = harness({
      currentItems: () => [itemRow('g0', 'h0'), itemRow('g1', null)],
      currentHeroes: () => [heroRow('h0'), heroRow('h1')],
      script: [ok()],
    });
    h.service.start(equipRequest([equipUnit(0, { toHeroId: 'h0', doneAt: ['h0'] }), equipUnit(1)]));
    const done = await untilDone(h.events);
    expect(done.result.skipped).toEqual([{ index: 0, reason: 'alreadyDone' }]);
    expect(done.result.skipped[0]).toBeDefined();
    expect('code' in (done.result.skipped[0] ?? {})).toBe(false);
  });

  it('a transport failure fails the unit with call, code null, resetDone false, and stops the run network', async () => {
    const failing: HttpTransport = () => Promise.reject(new Error('ECONNRESET'));
    const h = harness({ transport: failing });
    h.service.start(equipRequest([equipUnit(0)]));
    const done = await untilDone(h.events);
    expect(done.result).toMatchObject({
      made: 0,
      failed: { index: 0, call: 'equip', code: null, resetDone: false },
      stop: 'network',
      stopCode: null,
    });
  });

  it('a named refusal that maps to no skip stops refused, carrying the code on both the result and stopCode', async () => {
    const h = harness({ script: [apiError('SERVER_LOCKED')] });
    h.service.start(equipRequest([equipUnit(0)]));
    const done = await untilDone(h.events);
    expect(done.result).toMatchObject({
      made: 0,
      failed: { index: 0, call: 'equip', code: 'SERVER_LOCKED', resetDone: false },
      stop: 'refused',
      stopCode: 'SERVER_LOCKED',
    });
  });
});

describe('points step', () => {
  it('pendingFull sends respec then commit, in order, with the points vector encoded, and reports the server-quoted gold', async () => {
    const h = harness({ currentHeroes: () => [heroRow('h7')], script: [heroDetailOk([44, 0, 0, 0, 0, 0, 0, 0], 44, 30_000), ok(), ok()] });
    h.service.start(pointsRequest([pointsUnit()]));
    const done = await untilDone(h.events);
    expect(h.wire.requests.map((r) => r.path.split('?')[0])).toEqual(['/hero/detail', '/hero/stat/respec', '/hero/stat/commit']);
    expect(h.wire.requests[2]?.path).toContain('points=0%2C0%2C0%2C0%2C56%2C0%2C0%2C0');
    expect(done.result).toMatchObject({ made: 1, goldSpent: 30_000, stop: 'finished' });
  });

  it('pendingCommit (already reset) sends only commit, with no gold spent', async () => {
    const h = harness({ currentHeroes: () => [heroRow('h7')], script: [heroDetailOk([0, 0, 0, 0, 0, 0, 0, 0], 0), ok()] });
    h.service.start(pointsRequest([pointsUnit()]));
    const done = await untilDone(h.events);
    expect(h.wire.requests.map((r) => r.path.split('?')[0])).toEqual(['/hero/detail', '/hero/stat/commit']);
    expect(done.result).toMatchObject({ made: 1, goldSpent: 0, stop: 'finished' });
  });

  it('a shortfall against the running wallet skips notEnoughGold before any POST', async () => {
    const h = harness({ currentHeroes: () => [heroRow('h7')], currentGold: () => 100, script: [heroDetailOk([44, 0, 0, 0, 0, 0, 0, 0], 44, 30_000)] });
    h.service.start(pointsRequest([pointsUnit()]));
    const done = await untilDone(h.events);
    expect(h.wire.requests.map((r) => r.path.split('?')[0])).toEqual(['/hero/detail']);
    expect(done.result).toMatchObject({ made: 0, skipped: [{ index: 0, reason: 'notEnoughGold' }], stop: 'finished' });
  });

  it('a commit answered 404 after its respec skips resetNotPlaced, and the run finishes', async () => {
    const h = harness({ currentHeroes: () => [heroRow('h7')], script: [heroDetailOk([44, 0, 0, 0, 0, 0, 0, 0], 44, 30_000), ok(), plainHttpError(404)] });
    h.service.start(pointsRequest([pointsUnit()]));
    const done = await untilDone(h.events);
    expect(done.result).toMatchObject({ made: 0, skipped: [{ index: 0, reason: 'resetNotPlaced' }], stop: 'finished' });
  });

  it('a commit answered by a transport error after its respec fails the unit, keeping resetDone true, and the run stops network', async () => {
    let callCount = 0;
    const failing: HttpTransport = () => {
      callCount += 1;
      if (callCount === 1) return Promise.resolve({ status: 200, body: JSON.stringify({ alloc: [44, 0, 0, 0, 0, 0, 0, 0], stat_points_spent: 44, respec_gold_cost: 30_000 }) });
      if (callCount === 2) return Promise.resolve({ status: 200, body: '{}' });
      return Promise.reject(new Error('the socket died'));
    };
    const h = harness({ currentHeroes: () => [heroRow('h7')], transport: failing });
    h.service.start(pointsRequest([pointsUnit()]));
    const done = await untilDone(h.events);
    expect(done.result).toMatchObject({
      made: 0,
      failed: { index: 0, call: 'commit', code: null, resetDone: true },
      stop: 'network',
    });
  });
});

describe('cooldown and pacing', () => {
  function fakeClockHarness(overrides: Partial<ApplyServiceDeps> & { script?: Reply[] } = {}) {
    let clock = 1_000;
    const sleeps: number[] = [];
    const gate = createPacingGate({
      now: () => clock,
      sleep: (ms) => {
        clock += ms;
        return Promise.resolve();
      },
    });
    const h = harness({
      gate,
      now: () => clock,
      sleep: (ms) => {
        sleeps.push(ms);
        clock += ms;
        return Promise.resolve();
      },
      ...overrides,
    });
    return { ...h, sleeps };
  }

  it('a 429 pauses on the gate\'s 60s backoff, polls in <=1s steps, resends the same request id, and lands ok on wake', async () => {
    const h = fakeClockHarness({ script: [apiError('RATE_LIMIT', 429), ok()] });
    h.service.start(equipRequest([equipUnit(0)]));
    const done = await untilDone(h.events);

    const cooldown = h.events.find((e): e is Extract<ApplyEvent, { type: 'cooldown' }> => e.type === 'cooldown');
    expect(cooldown).toBeDefined();
    expect(cooldown?.resumeAtMs).toBe(1_000 + 60_000);
    expect(h.events.some((e) => e.type === 'resumed')).toBe(true);
    expect(h.sleeps.every((ms) => ms <= 1_000)).toBe(true);

    const ids = h.wire.requests.map((r) => requestIdOf(r.path));
    expect(ids[0]).toBe(ids[1]);
    expect(done.result).toMatchObject({ made: 1, stop: 'finished' });
  });

  it('a second 429 on the same call doubles the backoff window to 120s', async () => {
    const h = fakeClockHarness({ script: [apiError('RATE_LIMIT', 429), apiError('RATE_LIMIT', 429), ok()] });
    h.service.start(equipRequest([equipUnit(0)]));
    await untilDone(h.events);
    const cooldowns = h.events.filter((e): e is Extract<ApplyEvent, { type: 'cooldown' }> => e.type === 'cooldown');
    expect(cooldowns).toHaveLength(2);
    const [first, second] = cooldowns;
    expect((second?.resumeAtMs ?? 0) - (first?.resumeAtMs ?? 0)).toBe(120_000);
  });

  it('a PacingRefusedError raised by the gate before any send behaves the same as a 429 response', async () => {
    const h = fakeClockHarness({ script: [ok()] });
    h.gate.observe({ kind: 'cooldown' });
    h.service.start(equipRequest([equipUnit(0)]));
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(1);
    expect(done.result).toMatchObject({ made: 1, stop: 'finished' });
  });

  it('a halted gate at the first send ends the run unauthorized with made: 0, sending nothing', async () => {
    const h = fakeClockHarness({ script: [] });
    h.gate.observe({ kind: 'unauthorized' });
    h.service.start(equipRequest([equipUnit(0)]));
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(0);
    expect(done.result).toMatchObject({ made: 0, stop: 'unauthorized', failed: null });
  });
});

describe('Stop', () => {
  it('stop(unknownId) returns false', () => {
    const h = harness();
    expect(h.service.stop('does-not-exist')).toBe(false);
  });

  it('Stop after two units complete ends the run stopped, with no third send', async () => {
    const units = [equipUnit(0), equipUnit(1), equipUnit(2)];
    let runId: string | null = null;
    let stopped = false;
    const h = harness({
      currentItems: () => [itemRow('g0', null), itemRow('g1', null), itemRow('g2', null)],
      currentHeroes: () => [heroRow('h0'), heroRow('h1'), heroRow('h2')],
      script: [ok(), ok(), ok()],
      emit: (event) => {
        h.events.push(event);
        if (event.type === 'unit' && event.status === 'ok' && event.index === 1 && runId && !stopped) {
          stopped = true;
          h.service.stop(runId);
        }
      },
    });
    const started = h.service.start(equipRequest(units));
    if (started.ok) runId = started.runId;
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(2);
    expect(done.result).toMatchObject({ made: 2, stop: 'stopped' });
  });

  it('Stop pressed during an equip unit\'s cooldown pause ends the run stopped with no resend', async () => {
    let runId: string | null = null;
    const h = harness({
      script: [apiError('RATE_LIMIT', 429)],
      emit: (event) => {
        h.events.push(event);
        if (event.type === 'cooldown' && runId) h.service.stop(runId);
      },
    });
    const started = h.service.start(equipRequest([equipUnit(0)]));
    if (started.ok) runId = started.runId;
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(1);
    expect(done.result).toMatchObject({ made: 0, stop: 'stopped', failed: null });
  });

  it('Stop pressed during a commit\'s cooldown pause fails the unit with resetDone true and stops the run stopped', async () => {
    let runId: string | null = null;
    const h = harness({
      currentHeroes: () => [heroRow('h7')],
      script: [heroDetailOk([44, 0, 0, 0, 0, 0, 0, 0], 44, 30_000), ok(), apiError('RATE_LIMIT', 429)],
      emit: (event) => {
        h.events.push(event);
        if (event.type === 'cooldown' && runId) h.service.stop(runId);
      },
    });
    const started = h.service.start(pointsRequest([pointsUnit()]));
    if (started.ok) runId = started.runId;
    const done = await untilDone(h.events);
    expect(done.result).toMatchObject({
      made: 0,
      failed: { index: 0, call: 'commit', code: null, resetDone: true },
      stop: 'stopped',
    });
  });
});

describe('consent and game-running flips between units', () => {
  it('consent revoked between units ends the run consent_revoked before the next send', async () => {
    const units = [equipUnit(0), equipUnit(1)];
    let flipped = false;
    let consent: ConsentRecord = GRANTED;
    const h = harness({
      currentItems: () => [itemRow('g0', null), itemRow('g1', null)],
      currentHeroes: () => [heroRow('h0'), heroRow('h1')],
      consentStore: { read: () => consent },
      script: [ok()],
      emit: (event) => {
        h.events.push(event);
        if (event.type === 'unit' && event.status === 'ok' && !flipped) {
          flipped = true;
          consent = consentRecord({ decision: 'declined' });
        }
      },
    });
    h.service.start(equipRequest(units));
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(1);
    expect(done.result).toMatchObject({ made: 1, stop: 'consent_revoked', failed: null });
  });

  it('the game process gone between units ends the run game_not_running before the next send', async () => {
    const units = [equipUnit(0), equipUnit(1)];
    let flipped = false;
    let running = true;
    const h = harness({
      currentItems: () => [itemRow('g0', null), itemRow('g1', null)],
      currentHeroes: () => [heroRow('h0'), heroRow('h1')],
      isGameRunning: () => running,
      script: [ok()],
      emit: (event) => {
        h.events.push(event);
        if (event.type === 'unit' && event.status === 'ok' && !flipped) {
          flipped = true;
          running = false;
        }
      },
    });
    h.service.start(equipRequest(units));
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(1);
    expect(done.result).toMatchObject({ made: 1, stop: 'game_not_running', failed: null });
  });

  it('a consent revoked while paused ends the run consent_revoked instead of resending, with no failed entry', async () => {
    let clock = 1_000;
    let consent: ConsentRecord = GRANTED;
    const gate = createPacingGate({
      now: () => clock,
      sleep: (ms) => {
        clock += ms;
        return Promise.resolve();
      },
    });
    const h = harness({
      gate,
      now: () => clock,
      sleep: (ms) => {
        clock += ms;
        return Promise.resolve();
      },
      consentStore: { read: () => consent },
      script: [apiError('RATE_LIMIT', 429)],
      emit: (event) => {
        h.events.push(event);
        if (event.type === 'cooldown') consent = consentRecord({ decision: 'declined' });
      },
    });
    h.service.start(equipRequest([equipUnit(0)]));
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(1);
    expect(done.result).toMatchObject({ made: 0, stop: 'consent_revoked', failed: null });
  });

  it('the game process gone while paused ends the run game_not_running instead of resending, with no failed entry', async () => {
    let clock = 1_000;
    let running = true;
    const gate = createPacingGate({
      now: () => clock,
      sleep: (ms) => {
        clock += ms;
        return Promise.resolve();
      },
    });
    const h = harness({
      gate,
      now: () => clock,
      sleep: (ms) => {
        clock += ms;
        return Promise.resolve();
      },
      isGameRunning: () => running,
      script: [apiError('RATE_LIMIT', 429)],
      emit: (event) => {
        h.events.push(event);
        if (event.type === 'cooldown') running = false;
      },
    });
    h.service.start(equipRequest([equipUnit(0)]));
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(1);
    expect(done.result).toMatchObject({ made: 0, stop: 'game_not_running', failed: null });
  });
});

describe('every run, on done', () => {
  it('releases the lock, logs run.finished, calls requestReadNow exactly once, and emits done last', async () => {
    const infos: unknown[] = [];
    const h = harness({
      script: [ok()],
      log: { info: (entry) => infos.push(entry), warn: () => undefined, error: () => undefined },
    });
    const started = h.service.start(equipRequest([equipUnit(0)]));
    expect(started.ok).toBe(true);
    expect(h.writerLock.holder).toBe('apply');
    await untilDone(h.events);
    expect(h.writerLock.holder).toBeNull();
    expect(h.reads).toHaveLength(1);
    expect(h.events.at(-1)?.type).toBe('done');
    expect(infos).toContainEqual(
      expect.objectContaining({ scope: 'apply', event: 'run.finished', step: 'equip', made: 1, stop: 'finished' }),
    );
  });

  it('logs run.read_now_refused, naming the reason, when the read-now request is refused, without retrying it', async () => {
    const warnings: unknown[] = [];
    let readNowCalls = 0;
    const h = harness({
      script: [ok()],
      requestReadNow: () => {
        readNowCalls += 1;
        return { ok: false, reason: 'rate_limited' };
      },
      log: { info: () => undefined, warn: (entry) => warnings.push(entry), error: () => undefined },
    });
    h.service.start(equipRequest([equipUnit(0)]));
    await untilDone(h.events);
    expect(readNowCalls).toBe(1);
    expect(warnings).toEqual([expect.objectContaining({ scope: 'apply', event: 'run.read_now_refused', reason: 'rate_limited' })]);
  });

  it('run.finished names the plan and step alongside the counts', async () => {
    const infos: unknown[] = [];
    const h = harness({
      script: [ok()],
      log: { info: (entry) => infos.push(entry), warn: () => undefined, error: () => undefined },
    });
    const started = h.service.start({ step: 'equip', planRunId: 'plan-xyz', units: [equipUnit(0)] });
    const runId = started.ok ? started.runId : null;
    await untilDone(h.events);
    expect(infos).toContainEqual(
      expect.objectContaining({
        scope: 'apply',
        event: 'run.finished',
        runId,
        step: 'equip',
        planRunId: 'plan-xyz',
        made: 1,
        skipped: 0,
        stop: 'finished',
        gold: 0,
      }),
    );
  });
});

describe('isRunning', () => {
  it('is false before a start, true while a run is in flight, and false again once it is done', async () => {
    const h = harness({ script: [{ ...ok(), hold: true }] });
    expect(h.service.isRunning()).toBe(false);
    h.service.start(equipRequest([equipUnit(0)]));
    expect(h.service.isRunning()).toBe(true);
    for (let spin = 0; spin < 50 && h.wire.pendingCount() === 0; spin++) await new Promise((resolve) => setImmediate(resolve));
    h.wire.release();
    await untilDone(h.events);
    expect(h.service.isRunning()).toBe(false);
  });
});

describe('nothing_to_apply for the points step', () => {
  it('refuses when every unit\'s hero is missing from the cache', () => {
    const h = harness({ currentHeroes: () => [heroRow('someone-else')], script: [] });
    expect(h.service.start(pointsRequest([pointsUnit()]))).toEqual({ ok: false, reason: 'nothing_to_apply' });
    expect(h.wire.requests).toHaveLength(0);
  });
});

describe('the running wallet figure', () => {
  it('a null currentGold skips the wallet check and still spends what the server quotes', async () => {
    const h = harness({
      currentHeroes: () => [heroRow('h7')],
      currentGold: () => null,
      script: [heroDetailOk([44, 0, 0, 0, 0, 0, 0, 0], 44, 30_000), ok(), ok()],
    });
    h.service.start(pointsRequest([pointsUnit()]));
    const done = await untilDone(h.events);
    expect(h.wire.requests).toHaveLength(3);
    expect(done.result).toMatchObject({ made: 1, goldSpent: 30_000, stop: 'finished' });
    const okEvent = h.events.find((e): e is Extract<ApplyEvent, { type: 'unit' }> => e.type === 'unit' && e.status === 'ok');
    expect(okEvent).toMatchObject({ goldSpent: 30_000, walletAfter: null });
  });

  it('a known wallet is decremented by each unit\'s own gold spend and reported on the ok event', async () => {
    const h = harness({ currentGold: () => 1_000, script: [ok()] });
    h.service.start(equipRequest([equipUnit(0)]));
    await untilDone(h.events);
    const okEvent = h.events.find((e): e is Extract<ApplyEvent, { type: 'unit' }> => e.type === 'unit' && e.status === 'ok');
    expect(okEvent).toMatchObject({ goldSpent: 0, walletAfter: 1_000 });
  });
});
