import { describe, expect, it } from 'vitest';
import type { ForgeEvent, ForgeStartRequest } from '@bombfarm/contracts';
import { forgeRollCost } from '@bombfarm/domain/forge';
import {
  FORGE_ROUTES,
  SessionToken,
  createPacingGate,
  type ConsentRecord,
  type HttpResponse,
  type HttpTransport,
  type PacingGate,
} from '@bombfarm/game-api';
import { consentRecord, grantedConsent } from '@bombfarm/game-api/test-fixtures';
import type { ForgeAccountPatch } from './forge-account-patch.js';
import type { ForgeHistory, ForgeRunRecord } from './forge-history.js';
import { createForgeService, parseForgeReply, resolveForgeItem, type ForgeServiceDeps } from './forge-service.js';

const GRANTED = grantedConsent('2026-09-05T10:00:00.000Z');
const ITEM_ROW = { id: 'g1', def_id: 'steel_luva', rarity: 1, slot: 2, level: 20, upgrade: 8, locked: false };
const NOOP_LOG = { info: () => undefined, warn: () => undefined, error: () => undefined };

type Reply =
  | { upgrade: number; critical?: boolean; status?: undefined; body?: undefined; hold?: boolean }
  | { upgrade?: undefined; critical?: undefined; status: number; body: string; hold?: boolean };

/** Answers the two forge routes from a script, one reply per call, and records what it saw. A
 *  reply marked `hold` stays in flight until `release()`. */
function scriptedTransport(script: Reply[]) {
  const calls: { route: string; itemId: string }[] = [];
  const pending: (() => void)[] = [];
  const transport: HttpTransport = (req) => {
    const [route, query] = req.path.split('?');
    calls.push({ route: route ?? '', itemId: new URLSearchParams(query).get('item') ?? '' });
    const reply = script.shift();
    if (!reply) throw new Error(`no scripted reply for call ${String(calls.length)}`);
    const response: HttpResponse =
      reply.status !== undefined
        ? { status: reply.status, body: reply.body }
        : {
            status: 200,
            body: JSON.stringify({
              cost: 100,
              critical: reply.critical === true,
              gold: 1_000_000 - 100 * calls.length,
              item: { ...ITEM_ROW, upgrade: reply.upgrade },
            }),
          };
    if (reply.hold !== true) return Promise.resolve(response);
    return new Promise((resolve) => {
      pending.push(() => {
        resolve(response);
      });
    });
  };
  return {
    transport,
    calls,
    release() {
      for (const settle of pending.splice(0)) settle();
    },
    pendingCount: () => pending.length,
  };
}

function immediateGate(): PacingGate {
  return createPacingGate({ now: () => 0, sleep: () => Promise.resolve() });
}

function harness(overrides: Partial<ForgeServiceDeps> & { script?: Reply[]; consent?: ConsentRecord } = {}) {
  const wire = scriptedTransport(overrides.script ?? []);
  const events: ForgeEvent[] = [];
  const applied: ForgeAccountPatch[] = [];
  const appended: ForgeRunRecord[] = [];
  const sleeps: number[] = [];
  const history: ForgeHistory = {
    append: (record) => {
      appended.push(record);
    },
    list: () => ({ rows: [], totals: { runs: 0, spent: 0, rolls: 0, fails: 0 } }),
    clear: () => undefined,
  };
  const gate = overrides.gate ?? immediateGate();
  let clock = 1_000;
  const deps: ForgeServiceDeps = {
    consentStore: { read: () => overrides.consent ?? GRANTED },
    readToken: () => ({ ok: true, accountId: '486', token: SessionToken.create('sentinel-forge-do-not-leak'), mtimeMs: 1 }),
    settings: () => ({ forgeWritesEnabled: true }),
    transport: wire.transport,
    gate,
    accountSource: () => 'server',
    isGameRunning: () => true,
    currentItems: () => [ITEM_ROW],
    currentGold: () => 1_000_000,
    applyResult: (patch) => {
      applied.push(patch);
    },
    history,
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
  const service = createForgeService(deps);
  return { service, wire, events, applied, appended, sleeps, gate };
}

async function untilDone(events: ForgeEvent[]): Promise<Extract<ForgeEvent, { type: 'done' }>> {
  for (let spin = 0; spin < 200; spin++) {
    const done = events.find((event) => event.type === 'done');
    if (done) return done;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('the run never finished');
}

function steps(events: ForgeEvent[]) {
  return events.filter((event): event is Extract<ForgeEvent, { type: 'step' }> => event.type === 'step');
}

const REQUEST: ForgeStartRequest = { itemId: 'g1', target: 10, maxGold: null, maxAttempts: null };

describe('a full climb', () => {
  it('safe-jumps below the floor, rolls each rung, lands where the server says, and finishes on target', async () => {
    const h = harness({
      script: [{ upgrade: 8 }, { upgrade: 9 }, { upgrade: 10 }],
      currentItems: () => [{ ...ITEM_ROW, upgrade: 3 }],
    });
    const started = h.service.start(REQUEST);
    expect(started.ok).toBe(true);
    expect(h.service.isRunning()).toBe(true);

    const done = await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.route)).toEqual([FORGE_ROUTES.forgeToSafe, FORGE_ROUTES.forge, FORGE_ROUTES.forge]);
    expect(h.wire.calls.every((call) => call.itemId === 'g1')).toBe(true);
    expect(steps(h.events).map((step) => [step.kind, step.from, step.to, step.outcome])).toEqual([
      ['safe', 3, 8, 'success'],
      ['roll', 8, 9, 'success'],
      ['roll', 9, 10, 'success'],
    ]);
    expect(done.result).toMatchObject({
      itemId: 'g1',
      from: 3,
      to: 10,
      target: 10,
      stop: 'target',
      reached: true,
      rolls: 2,
      fails: 0,
      crits: 0,
      safeJumps: 1,
      spent: 300,
      walletAfter: 1_000_000 - 300,
    });
    expect(h.service.isRunning()).toBe(false);
  });

  it('sleeps the gate\'s forge delay between calls and never before the first', async () => {
    const h = harness({ script: [{ upgrade: 9 }, { upgrade: 10 }] });
    h.service.start(REQUEST);
    await untilDone(h.events);
    expect(h.sleeps).toEqual([h.gate.nextForgeDelayMs(() => 0.5)]);
  });

  it('announces every call before making it — the first with no gap at all — so the screen can hold its place', async () => {
    const h = harness({ script: [{ upgrade: 9 }, { upgrade: 10 }, { upgrade: 11 }] });
    h.service.start({ ...REQUEST, target: 11 });
    await untilDone(h.events);
    const pauses = h.events.filter((event): event is Extract<ForgeEvent, { type: 'pause' }> => event.type === 'pause');
    expect(pauses.map((pause) => pause.ms)).toEqual([0, ...h.sleeps]);
    expect(h.events.map((event) => event.type)).toEqual(['pause', 'step', 'pause', 'step', 'pause', 'step', 'done']);
  });

  it('reads a critical from the server, not from the odds, and lands the piece where the server put it', async () => {
    const h = harness({ script: [{ upgrade: 10, critical: true }] });
    h.service.start({ ...REQUEST, target: 9 });
    const done = await untilDone(h.events);
    expect(steps(h.events)[0]).toMatchObject({ target: 9, to: 10, outcome: 'critical' });
    expect(done.result).toMatchObject({ to: 10, crits: 1, rolls: 1, stop: 'target' });
  });

  it('patches the account with the server\'s last item and gold, then writes exactly one ledger row', async () => {
    const h = harness({ script: [{ upgrade: 9 }, { upgrade: 8 }, { upgrade: 9 }, { upgrade: 10 }] });
    h.service.start(REQUEST);
    await untilDone(h.events);
    expect(h.applied).toHaveLength(1);
    expect(h.applied[0]).toMatchObject({ itemId: 'g1', item: { id: 'g1', upgrade: 10 }, gold: 1_000_000 - 400 });
    expect(h.appended).toHaveLength(1);
    expect(h.appended[0]).toMatchObject({
      accountId: '486',
      itemId: 'g1',
      defId: 'steel_luva',
      rarity: 1,
      slot: 2,
      itemLevel: 20,
      fromUpgrade: 8,
      toUpgrade: 10,
      target: 10,
      stop: 'target',
      reached: true,
      rolls: 4,
      fails: 1,
      crits: 0,
      safeJumps: 0,
      spent: 400,
      walletAfter: 1_000_000 - 400,
    });
    expect(h.appended[0]?.durationMs).toBeGreaterThan(0);
  });
});

describe('stopping', () => {
  it('cancel is honoured between rolls only — the call in flight settles and counts', async () => {
    const h = harness({ script: [{ upgrade: 9 }, { upgrade: 10, hold: true }] });
    const started = h.service.start({ ...REQUEST, target: 12 });
    if (!started.ok) throw new Error('did not start');
    await untilStep(h.events, 1);
    for (let spin = 0; spin < 50 && h.wire.pendingCount() === 0; spin++) await new Promise((resolve) => setImmediate(resolve));
    expect(h.wire.pendingCount()).toBe(1);
    expect(h.service.cancel(started.runId)).toBe(true);
    h.wire.release();

    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(2);
    expect(steps(h.events)).toHaveLength(2);
    expect(done.result).toMatchObject({ stop: 'cancelled', to: 10, reached: false, rolls: 2, spent: 200 });
    expect(h.service.cancel(started.runId)).toBe(false);
  });

  it('a cooldown mid-run feeds the gate\'s backoff and stops the run with cooldown', async () => {
    const h = harness({ script: [{ upgrade: 9 }, { status: 429, body: '{"error":"RATE_LIMIT"}' }] });
    h.service.start({ ...REQUEST, target: 12 });
    const done = await untilDone(h.events);
    expect(done.result).toMatchObject({ stop: 'cooldown', to: 9, rolls: 1, spent: 100 });
    expect(h.gate.state).toEqual({ backoffUntil: 60_000 });
    expect(h.applied).toHaveLength(1);
    expect(h.appended[0]?.stop).toBe('cooldown');
  });

  it('a budget stop never sends the roll it cannot afford', async () => {
    const servedCostOfFirstRoll = 100;
    const affordableOnce = servedCostOfFirstRoll + forgeRollCost(20, 1, 10) - 1;
    const h = harness({ script: [{ upgrade: 9 }] });
    h.service.start({ ...REQUEST, maxGold: affordableOnce });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(1);
    expect(done.result).toMatchObject({ stop: 'budget', to: 9, rolls: 1 });
  });

  it('a shortfall against a known wallet stops before the first call, with no patch and no ledger row', async () => {
    const h = harness({ script: [{ upgrade: 9 }], currentGold: () => 10 });
    h.service.start(REQUEST);
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(0);
    expect(done.result).toMatchObject({ stop: 'shortfall', to: 8, rolls: 0, spent: 0 });
    expect(h.applied).toHaveLength(0);
    expect(h.appended).toHaveLength(0);
  });

  it('the attempt limit counts rolls, not safe jumps', async () => {
    const h = harness({
      script: [{ upgrade: 8 }, { upgrade: 9 }, { upgrade: 10 }],
      currentItems: () => [{ ...ITEM_ROW, upgrade: 3 }],
    });
    h.service.start({ ...REQUEST, target: 12, maxAttempts: 2 });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(3);
    expect(done.result).toMatchObject({ stop: 'attempts', rolls: 2, safeJumps: 1, to: 10 });
  });

  it('an HTTP error for the item stops with missing; an unauthorized answer halts the gate and stops with error', async () => {
    const missing = harness({ script: [{ status: 404, body: '{"error":"not found"}' }] });
    missing.service.start(REQUEST);
    expect((await untilDone(missing.events)).result.stop).toBe('missing');

    const unauthorized = harness({ script: [{ status: 401, body: '' }] });
    unauthorized.service.start(REQUEST);
    expect((await untilDone(unauthorized.events)).result.stop).toBe('error');
    expect(unauthorized.gate.state).toBe('halted');
  });
});

describe('refusals', () => {
  it('a second start while one is active is busy, and a start after done is not', async () => {
    const h = harness({ script: [{ upgrade: 9, hold: true }, { upgrade: 10 }, { upgrade: 9 }, { upgrade: 10 }] });
    expect(h.service.start(REQUEST).ok).toBe(true);
    expect(h.service.start(REQUEST)).toEqual({ ok: false, reason: 'busy' });
    for (let spin = 0; spin < 50 && h.wire.pendingCount() === 0; spin++) await new Promise((resolve) => setImmediate(resolve));
    h.wire.release();
    await untilDone(h.events);
    h.events.length = 0;
    expect(h.service.start(REQUEST).ok).toBe(true);
    await untilDone(h.events);
  });

  it('names why it will not start, and sends nothing when it refuses', () => {
    const cases: [Partial<ForgeServiceDeps> & { consent?: ConsentRecord }, ForgeStartRequest, string][] = [
      [{ accountSource: () => 'fixture' }, REQUEST, 'offline'],
      [{}, { ...REQUEST, itemId: 'nope' }, 'unknown_item'],
      [{}, { ...REQUEST, target: 8 }, 'bad_target'],
      [{}, { ...REQUEST, target: 16 }, 'bad_target'],
      [{ consent: consentRecord({ decision: 'declined' }) }, REQUEST, 'not_consented'],
      [{ isGameRunning: () => false }, REQUEST, 'game_not_running'],
      [{ readToken: () => ({ ok: false, reason: 'not_found' }) }, REQUEST, 'token_unavailable'],
      [{ settings: () => ({ forgeWritesEnabled: false }) }, REQUEST, 'writes_disabled'],
    ];
    for (const [overrides, request, reason] of cases) {
      const h = harness({ ...overrides, script: [{ upgrade: 9 }] });
      expect(h.service.start(request), reason).toEqual({ ok: false, reason });
      expect(h.wire.calls, reason).toHaveLength(0);
      expect(h.service.isRunning(), reason).toBe(false);
    }
  });
});

describe('resolveForgeItem / parseForgeReply', () => {
  it('reads the piece from the items section and refuses a level the cost table does not carry', () => {
    expect(resolveForgeItem([ITEM_ROW], 'g1')).toEqual({ id: 'g1', defId: 'steel_luva', rarity: 1, slot: 2, level: 20, upgrade: 8 });
    expect(resolveForgeItem([{ ...ITEM_ROW, level: 21 }], 'g1')).toBeNull();
    expect(resolveForgeItem([ITEM_ROW], 'g2')).toBeNull();
    expect(resolveForgeItem(null, 'g1')).toBeNull();
  });

  it('needs the returned item\'s upgrade and reads the wallet as a number even when the wire quotes it', () => {
    expect(parseForgeReply({ cost: 5, critical: false, gold: '99', item: { id: 'g1', upgrade: 9 } })).toEqual({
      item: { id: 'g1', upgrade: 9 },
      upgrade: 9,
      cost: 5,
      gold: 99,
      critical: false,
    });
    expect(parseForgeReply({ item: {} })).toBeNull();
    expect(parseForgeReply('nope')).toBeNull();
  });
});

async function untilStep(events: ForgeEvent[], count: number): Promise<void> {
  for (let spin = 0; spin < 200; spin++) {
    if (steps(events).length >= count) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`never saw ${String(count)} step(s)`);
}
