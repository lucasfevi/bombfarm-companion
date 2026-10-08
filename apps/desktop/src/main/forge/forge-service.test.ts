import { describe, expect, it } from 'vitest';
import type { ForgeEvent, ForgeStartRequest } from '@bombfarm/contracts';
import { forgeRollCost, forgeRollEssence } from '@bombfarm/domain/forge';
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
import { createWriterLock } from '../apply/writer-lock.js';
import type { ForgeAccountPatch } from './forge-account-patch.js';
import type { ForgeHistory, ForgeRunRecord } from './forge-history.js';
import {
  createForgeService,
  parseForgeReply,
  resolveForgeItem,
  scrollCostOf,
  usableStoneCounts,
  type ForgeServiceDeps,
} from './forge-service.js';

const GRANTED = grantedConsent('2026-09-05T10:00:00.000Z');
const ITEM_ROW = { id: 'g1', def_id: 'steel_luva', rarity: 1, slot: 2, level: 20, upgrade: 8, locked: false };
const NOOP_LOG = { info: () => undefined, warn: () => undefined, error: () => undefined };

type Reply =
  | { upgrade: number; critical?: boolean; stone?: number; scroll?: number; scrollCost?: number; essence?: number; essenceCost?: number; status?: undefined; body?: undefined; hold?: boolean }
  | { upgrade?: undefined; critical?: undefined; stone?: undefined; scroll?: undefined; scrollCost?: undefined; essence?: undefined; essenceCost?: undefined; status: number; body: string; hold?: boolean };

/** Answers the two forge routes from a script, one reply per call, and records what it saw. A
 *  reply marked `hold` stays in flight until `release()`. */
function scriptedTransport(script: Reply[]) {
  const calls: { route: string; itemId: string; pedra: string | null; pergaminho: string | null; requestId: string | null }[] = [];
  const pending: (() => void)[] = [];
  const transport: HttpTransport = (req) => {
    const [route, query] = req.path.split('?');
    const params = new URLSearchParams(query);
    calls.push({
      route: route ?? '',
      itemId: params.get('item') ?? '',
      pedra: params.get('pedra'),
      pergaminho: params.get('pergaminho'),
      requestId: params.get('request_id'),
    });
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
              item: { ...ITEM_ROW, upgrade: reply.upgrade, ...(reply.scrollCost === undefined ? {} : { pergaminho_custo: reply.scrollCost }) },
              pedra_gasta: reply.stone ?? -1,
              ...(reply.essence === undefined ? {} : { essence: reply.essence }),
              ...(reply.essenceCost === undefined ? {} : { essence_cost: reply.essenceCost }),
              pergaminho_pago: reply.scroll ?? 0,
              pergaminho_protegeu: (reply.scroll ?? 0) > 0,
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
    list: () => ({ rows: [], totals: { runs: 0, spent: 0, essence: 0, rolls: 0, fails: 0 } }),
    clear: () => undefined,
  };
  const gate = overrides.gate ?? immediateGate();
  const writerLock = overrides.writerLock ?? createWriterLock();
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
    writerLock,
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
  return { service, wire, events, applied, appended, sleeps, gate, writerLock };
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
  it('rolls every rung from the bottom — never a safe jump — lands where the server says, and finishes on target', async () => {
    const h = harness({
      script: [{ upgrade: 4 }, { upgrade: 5 }, { upgrade: 6 }],
      currentItems: () => [{ ...ITEM_ROW, upgrade: 3 }],
    });
    const started = h.service.start({ ...REQUEST, target: 6 });
    expect(started.ok).toBe(true);
    expect(h.service.isRunning()).toBe(true);

    const done = await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.route)).toEqual([FORGE_ROUTES.forge, FORGE_ROUTES.forge, FORGE_ROUTES.forge]);
    expect(h.wire.calls.every((call) => call.itemId === 'g1')).toBe(true);
    expect(steps(h.events).map((step) => [step.kind, step.from, step.to, step.outcome])).toEqual([
      ['roll', 3, 4, 'success'],
      ['roll', 4, 5, 'success'],
      ['roll', 5, 6, 'success'],
    ]);
    expect(done.result).toMatchObject({
      itemId: 'g1',
      from: 3,
      to: 6,
      target: 6,
      stop: 'target',
      reached: true,
      rolls: 3,
      fails: 0,
      crits: 0,
      safeJumps: 0,
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

  it('the attempt limit counts rolls', async () => {
    const h = harness({
      script: [{ upgrade: 4 }, { upgrade: 5 }],
      currentItems: () => [{ ...ITEM_ROW, upgrade: 3 }],
    });
    h.service.start({ ...REQUEST, target: 12, maxAttempts: 2 });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(2);
    expect(done.result).toMatchObject({ stop: 'attempts', rolls: 2, safeJumps: 0, to: 5 });
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
      expect(h.writerLock.holder, reason).toBeNull();
    }
  });

  it('answers busy through the shared writer lock when the apply run holds it, without touching the transport', () => {
    const lock = createWriterLock();
    lock.acquire('apply');
    const h = harness({ writerLock: lock, script: [{ upgrade: 9 }] });
    expect(h.service.start(REQUEST)).toEqual({ ok: false, reason: 'busy' });
    expect(h.wire.calls).toHaveLength(0);
    expect(h.service.isRunning()).toBe(false);
  });

  it('a completed run releases the writer lock', async () => {
    const h = harness({ script: [{ upgrade: 9 }, { upgrade: 10 }] });
    expect(h.writerLock.holder).toBeNull();
    h.service.start(REQUEST);
    expect(h.writerLock.holder).toBe('forge');
    await untilDone(h.events);
    expect(h.writerLock.holder).toBeNull();
  });
});

describe('resolveForgeItem / parseForgeReply', () => {
  it('reads the piece from the items section and refuses a level the cost table does not carry', () => {
    expect(resolveForgeItem([ITEM_ROW], 'g1')).toEqual({ id: 'g1', defId: 'steel_luva', rarity: 1, slot: 2, level: 20, upgrade: 8, fails: 0, scrollCost: 0 });
    expect(resolveForgeItem([{ ...ITEM_ROW, level: 21 }], 'g1')).toBeNull();
    expect(resolveForgeItem([ITEM_ROW], 'g2')).toBeNull();
    expect(resolveForgeItem(null, 'g1')).toBeNull();
  });

  it('refuses a row that carries no forge level rather than forging it as an unforged piece', () => {
    const { upgrade: _upgrade, ...withoutUpgrade } = ITEM_ROW;
    expect(resolveForgeItem([withoutUpgrade], 'g1')).toBeNull();
  });

  it('carries the misses in a row the item reports, and none when it reports none', () => {
    expect(resolveForgeItem([{ ...ITEM_ROW, forge_fails: 3 }], 'g1')?.fails).toBe(3);
    expect(resolveForgeItem([{ ...ITEM_ROW, forge_fails: -1 }], 'g1')?.fails).toBe(0);
    expect(resolveForgeItem([ITEM_ROW], 'g1')?.fails).toBe(0);
  });

  it('needs the returned item\'s upgrade and reads the wallet as a number even when the wire quotes it', () => {
    expect(parseForgeReply({ cost: 5, critical: false, gold: '99', item: { id: 'g1', upgrade: 9 } })).toEqual({
      item: { id: 'g1', upgrade: 9 },
      upgrade: 9,
      cost: 5,
      gold: 99,
      critical: false,
      fails: null,
      stone: null,
      scrollPaid: 0,
      essenceCost: null,
      essence: null,
    });
    expect(parseForgeReply({ item: { id: 'g1', upgrade: 9 }, essence_cost: 64, pergaminho_pago: 0 })).toMatchObject({ essenceCost: 64, scrollPaid: 0 });
    expect(parseForgeReply({ item: { id: 'g1', upgrade: 9 }, pedra_gasta: 2 })?.stone).toBe(2);
    expect(parseForgeReply({ item: { id: 'g1', upgrade: 9 }, pedra_gasta: -1 })?.stone).toBeNull();
    expect(parseForgeReply({ item: { id: 'g1', upgrade: 9 }, pedra_gasta: 9 })?.stone).toBeNull();
    expect(parseForgeReply({ item: { id: 'g1', upgrade: 8, forge_fails: 2 } })?.fails).toBe(2);
    expect(parseForgeReply({ item: {} })).toBeNull();
    expect(parseForgeReply('nope')).toBeNull();
  });
});

const stoneRow = (id: string, word: string, extra: Record<string, unknown> = {}) => ({
  id,
  def_id: 'forja_pedra_' + word,
  category: 8,
  rarity: 0,
  market_state: 0,
  equipped_on: null,
  locked: false,
  ...extra,
});

const CAPTURED_MISS = {
  cost: '59625',
  critical: false,
  essence: 212464,
  essence_cost: 64,
  forge_fails: 1,
  gold: '2101016350',
  item: { id: 'g1', def_id: 'steel_luva', rarity: 1, slot: 2, level: 20, upgrade: 12, forge_fails: 1, forge_chance: 0.25, pergaminho_custo: 864 },
  pedra_gasta: 0,
  pergaminho_pago: 0,
  pergaminho_protegeu: false,
  success: false,
  target: 14,
};

describe('Chance Stones', () => {
  const OWNED = [stoneRow('s1', 'comum'), stoneRow('s2', 'comum'), stoneRow('s3', 'raro')];
  const items = (rows: unknown[] = OWNED) => () => [ITEM_ROW, ...rows];
  const stonesFor = (rarity: number | null, upTo = 10): (number | null)[] =>
    Array.from({ length: upTo }, (_, index) => (index + 1 >= 9 ? rarity : null));

  it('counts only the stones the game would offer', () => {
    expect(
      usableStoneCounts([
        stoneRow('a', 'comum'),
        stoneRow('b', 'comum', { locked: true }),
        stoneRow('c', 'comum', { market_state: 1 }),
        stoneRow('d', 'comum', { equipped_on: 'h1' }),
        stoneRow('e', 'comum', { category: 3 }),
        stoneRow('f', 'mitico'),
        stoneRow('g', 'epico'),
        ITEM_ROW,
      ]),
    ).toEqual([1, 0, 0, 1, 0, 1]);
    expect(usableStoneCounts(null)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('sends the chosen stone only on the rolls that can miss', async () => {
    const h = harness({
      script: [{ upgrade: 4 }, { upgrade: 5, stone: 0 }, { upgrade: 6, stone: 0 }],
      currentItems: () => [{ ...ITEM_ROW, upgrade: 3 }, ...OWNED],
    });
    h.service.start({ ...REQUEST, target: 6, stones: [0, 0, 0, 0, 0, 0] });
    const done = await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.pedra)).toEqual([null, '0', '0']);
    expect(h.wire.calls.map((call) => call.pergaminho)).toEqual([null, null, null]);
    expect(done.result).toMatchObject({ stop: 'target', stonesSpent: [2, 0, 0, 0, 0, 0] });
  });

  it('a split plan spends each kind on its own targets and carries the stones through events, result and ledger row', async () => {
    const stones = [null, null, null, null, null, null, null, null, 0, 2];
    const h = harness({ script: [{ upgrade: 9, stone: 0 }, { upgrade: 10, stone: 2 }], currentItems: items([stoneRow('s1', 'comum'), stoneRow('s2', 'raro')]) });
    h.service.start({ ...REQUEST, stones });
    const done = await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.pedra)).toEqual(['0', '2']);
    expect(steps(h.events).map((step) => step.stone)).toEqual([0, 2]);
    expect(done.result).toMatchObject({ stop: 'target', stonesSpent: [1, 0, 1, 0, 0, 0] });
    expect(h.appended[0]).toMatchObject({ stonesSpent: [1, 0, 1, 0, 0, 0], stoneRarity: null });
  });

  it('decrements the owned count on every reply and stops, without sending, once the kind is used up', async () => {
    const h = harness({
      script: [{ upgrade: 9, stone: 0 }, { upgrade: 8, stone: 0 }],
      currentItems: items([stoneRow('s1', 'comum'), stoneRow('s2', 'comum')]),
    });
    h.service.start({ ...REQUEST, target: 12, stones: stonesFor(0, 12) });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(2);
    expect(done.result).toMatchObject({ stop: 'stones', stoneRarity: 0, stonesSpent: [2, 0, 0, 0, 0, 0], rolls: 2 });
  });

  it('stops before the first call when a chosen kind is not owned at all', async () => {
    const h = harness({ script: [{ upgrade: 9 }], currentItems: items([stoneRow('s1', 'comum')]) });
    h.service.start({ ...REQUEST, stones: stonesFor(4) });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(0);
    expect(done.result).toMatchObject({ stop: 'stones', stoneRarity: 4, rolls: 0 });
    expect(h.appended).toHaveLength(0);
  });

  it('stops when the server used a different stone than the one asked for, after counting the roll it made', async () => {
    const h = harness({ script: [{ upgrade: 9, stone: 1 }, { upgrade: 10, stone: 1 }], currentItems: items() });
    h.service.start({ ...REQUEST, stones: stonesFor(0) });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(1);
    expect(done.result).toMatchObject({ stop: 'stone_mismatch', rolls: 1, stoneRarity: 0, stonesSpent: [0, 1, 0, 0, 0, 0] });
  });

  it('stops when the server says no stone was used though one was sent, and when it used one that was not sent', async () => {
    const none = harness({ script: [{ upgrade: 9 }, { upgrade: 10 }], currentItems: items() });
    none.service.start({ ...REQUEST, stones: stonesFor(0) });
    expect((await untilDone(none.events)).result).toMatchObject({ stop: 'stone_mismatch', rolls: 1, stonesSpent: [0, 0, 0, 0, 0, 0] });

    const unasked = harness({ script: [{ upgrade: 9, stone: 0 }, { upgrade: 10 }], currentItems: items() });
    unasked.service.start(REQUEST);
    expect((await untilDone(unasked.events)).result).toMatchObject({ stop: 'stone_mismatch', rolls: 1, stonesSpent: [1, 0, 0, 0, 0, 0] });
  });

  it('stops on NO_FORGE_AID naming the kind, with nothing counted for the refused roll', async () => {
    const h = harness({ script: [{ status: 400, body: '{"error":"NO_FORGE_AID"}' }], currentItems: items() });
    h.service.start({ ...REQUEST, stones: stonesFor(2) });
    const done = await untilDone(h.events);
    expect(done.result).toMatchObject({ stop: 'stones', stoneRarity: 2, rolls: 0, stonesSpent: [0, 0, 0, 0, 0, 0] });
    expect(h.wire.calls).toHaveLength(1);
  });

  it('rolls on without a stone when none is owned and the plan does not stop for stones', async () => {
    const h = harness({ script: [{ upgrade: 9 }, { upgrade: 10 }], currentItems: items([stoneRow('s1', 'comum')]) });
    h.service.start({ ...REQUEST, stones: stonesFor(4), stopWhenOutOfStones: false });
    const done = await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.pedra)).toEqual([null, null]);
    expect(done.result).toMatchObject({ stop: 'target', rolls: 2, stonesSpent: [0, 0, 0, 0, 0, 0] });
  });

  it('resends the roll without the stone when the server says none is left and the plan does not stop for stones', async () => {
    const h = harness({
      script: [{ status: 400, body: '{"error":"NO_FORGE_AID"}' }, { upgrade: 9 }, { upgrade: 10 }],
      currentItems: items(),
    });
    h.service.start({ ...REQUEST, stones: stonesFor(2), stopWhenOutOfStones: false });
    const done = await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.pedra)).toEqual(['2', null, null]);
    expect(new Set(h.wire.calls.map((call) => call.requestId)).size).toBe(3);
    expect(done.result).toMatchObject({ stop: 'target', rolls: 2, stonesSpent: [0, 0, 0, 0, 0, 0] });
  });

  it('still stops for stones when the plan says so explicitly', async () => {
    const h = harness({ script: [{ upgrade: 9 }], currentItems: items([stoneRow('s1', 'comum')]) });
    h.service.start({ ...REQUEST, stones: stonesFor(4), stopWhenOutOfStones: true });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(0);
    expect(done.result).toMatchObject({ stop: 'stones', stoneRarity: 4, rolls: 0 });
  });

  it('retries a roll once without the stone on FORGE_AID_USELESS, under a new request id, and carries on', async () => {
    const h = harness({
      script: [{ status: 400, body: '{"error":"FORGE_AID_USELESS"}' }, { upgrade: 9 }, { upgrade: 10 }],
      currentItems: items(),
    });
    h.service.start({ ...REQUEST, stones: [null, null, null, null, null, null, null, null, 0, null] });
    const done = await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.pedra)).toEqual(['0', null, null]);
    expect(new Set(h.wire.calls.map((call) => call.requestId)).size).toBe(3);
    expect(done.result).toMatchObject({ stop: 'target', rolls: 2, stonesSpent: [0, 0, 0, 0, 0, 0] });
  });

  it('retries only once: a second refusal without the stone ends the run as an ordinary refusal', async () => {
    const h = harness({
      script: [{ status: 400, body: '{"error":"FORGE_AID_USELESS"}' }, { status: 400, body: '{"error":"FORGE_AID_USELESS"}' }],
      currentItems: items(),
    });
    h.service.start({ ...REQUEST, stones: stonesFor(0) });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(2);
    expect(done.result.stop).toBe('missing');
  });

  it('reads the captured reply of a stone roll that missed', () => {
    expect(parseForgeReply(CAPTURED_MISS)).toMatchObject({ upgrade: 12, stone: 0, cost: 59625, fails: 1, critical: false });
  });

  it('a run with no stones chosen never names pedra, whatever the bag holds', async () => {
    const h = harness({ script: [{ upgrade: 9 }, { upgrade: 10 }], currentItems: items() });
    h.service.start(REQUEST);
    await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.pedra)).toEqual([null, null]);
  });

  it('an essence shortfall ends the run as a shortfall rather than a refused item', async () => {
    const h = harness({ script: [{ status: 400, body: '{"error":"NOT_ENOUGH_ESSENCE"}' }] });
    h.service.start(REQUEST);
    expect((await untilDone(h.events)).result.stop).toBe('shortfall');
  });
});

describe('the essence a run is charged', () => {
  it("adds up each reply's essence_cost, on the events, the result and the ledger row", async () => {
    const h = harness({ script: [{ upgrade: 9, essenceCost: 64 }, { upgrade: 10, essenceCost: 70 }] });
    h.service.start(REQUEST);
    const done = await untilDone(h.events);
    expect(steps(h.events).map((step) => step.essence)).toEqual([64, 70]);
    expect(done.result).toMatchObject({ stop: 'target', essence: 134 });
    expect(h.appended[0]).toMatchObject({ essence: 134 });
  });

  it('prices a roll from the rules when the reply does not say what it cost', async () => {
    const h = harness({ script: [{ upgrade: 9 }, { upgrade: 10 }] });
    h.service.start(REQUEST);
    const done = await untilDone(h.events);
    expect(done.result.essence).toBe(forgeRollEssence(20, 1, 9) + forgeRollEssence(20, 1, 10));
  });

  it("puts the Protection Scroll on top of the roll's own essence", async () => {
    const h = harness({
      script: [{ upgrade: 11 }, { upgrade: 12, scroll: 12_320, essenceCost: 100 }],
      currentItems: () => [{ ...ITEM_ROW, upgrade: 10, pergaminho_custo: 0 }],
    });
    h.service.start({ ...REQUEST, target: 12, scroll: true });
    const done = await untilDone(h.events);
    const [first, second] = steps(h.events);
    expect(second?.essence).toBe(12_420);
    expect(second?.scrollEssence).toBe(12_320);
    expect(done.result).toMatchObject({ essence: (first?.essence ?? 0) + 12_420, scrollEssence: 12_320 });
  });
});

describe('the Protection Scroll', () => {
  const AT_11 = { ...ITEM_ROW, upgrade: 11, pergaminho_custo: 12_320 };

  it('is sent only on the rolls the game offers it on, and the essence it costs is tallied from the replies', async () => {
    const h = harness({
      script: [{ upgrade: 11 }, { upgrade: 12, scroll: 12_320 }, { upgrade: 13, scroll: 14_000 }],
      currentItems: () => [{ ...ITEM_ROW, upgrade: 10, pergaminho_custo: 0 }],
    });
    h.service.start({ ...REQUEST, target: 13, scroll: true });
    const done = await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.pergaminho)).toEqual([null, '1', '1']);
    expect(steps(h.events).map((step) => step.scrollEssence)).toEqual([0, 12_320, 14_000]);
    expect(done.result).toMatchObject({ stop: 'target', rolls: 3, scrollEssence: 26_320 });
    expect(h.appended[0]).toMatchObject({ scrollEssence: 26_320 });
  });

  it('is never sent when the plan did not ask for it, even on a rung that offers it', async () => {
    const h = harness({ script: [{ upgrade: 12 }], currentItems: () => [AT_11] });
    h.service.start({ ...REQUEST, target: 12 });
    const done = await untilDone(h.events);
    expect(h.wire.calls.map((call) => call.pergaminho)).toEqual([null]);
    expect(done.result).toMatchObject({ stop: 'target', scrollEssence: 0 });
  });

  it('stops, counting the roll it made, when the game did not charge a scroll that was sent', async () => {
    const h = harness({ script: [{ upgrade: 12 }, { upgrade: 13 }], currentItems: () => [AT_11] });
    h.service.start({ ...REQUEST, target: 13, scroll: true });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(1);
    expect(done.result).toMatchObject({ stop: 'scroll_mismatch', rolls: 1, scrollEssence: 0 });
  });

  it('stops when the game charged a scroll that was not sent', async () => {
    const h = harness({ script: [{ upgrade: 9, scroll: 500 }, { upgrade: 10 }] });
    h.service.start(REQUEST);
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(1);
    expect(done.result).toMatchObject({ stop: 'scroll_mismatch', rolls: 1, scrollEssence: 500 });
  });

  it('stops before sending when the essence on hand cannot pay for the roll and its scroll', async () => {
    const h = harness({ script: [{ upgrade: 12, scroll: 12_320 }], currentItems: () => [AT_11], currentEssence: () => 12_000 });
    h.service.start({ ...REQUEST, target: 12, scroll: true });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(0);
    expect(done.result).toMatchObject({ stop: 'shortfall', rolls: 0 });
  });

  it('keeps the balance as it goes, so a later roll that cannot be paid is not sent', async () => {
    const h = harness({
      script: [{ upgrade: 12, scroll: 12_320, scrollCost: 14_000 }, { upgrade: 13, scroll: 14_000 }],
      currentItems: () => [AT_11],
      currentEssence: () => 25_000,
    });
    h.service.start({ ...REQUEST, target: 13, scroll: true });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(1);
    expect(done.result).toMatchObject({ stop: 'shortfall', rolls: 1, to: 12 });
  });

  it('takes the balance from each reply over its own subtraction, so the next check is against what the server holds', async () => {
    const h = harness({
      script: [{ upgrade: 12, scroll: 12_320, scrollCost: 14_000, essence: 500 }, { upgrade: 13, scroll: 14_000 }],
      currentItems: () => [AT_11],
      currentEssence: () => 1_000_000,
    });
    h.service.start({ ...REQUEST, target: 13, scroll: true });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(1);
    expect(done.result).toMatchObject({ stop: 'shortfall', rolls: 1, to: 12 });
  });

  it('reads the balance a reply reports as a number, and nothing when it does not', () => {
    expect(parseForgeReply({ item: { id: 'g1', upgrade: 9 }, essence: 4_200 })?.essence).toBe(4_200);
    expect(parseForgeReply({ item: { id: 'g1', upgrade: 9 } })?.essence).toBeNull();
  });

  it('stops without sending when the plan wants a scroll the item says the game does not offer', async () => {
    const h = harness({ script: [{ upgrade: 12 }], currentItems: () => [{ ...AT_11, pergaminho_custo: 0 }] });
    h.service.start({ ...REQUEST, target: 12, scroll: true });
    const done = await untilDone(h.events);
    expect(h.wire.calls).toHaveLength(0);
    expect(done.result).toMatchObject({ stop: 'scroll_mismatch', rolls: 0 });
  });

  it('reads the price the item carries for its next roll, and the published one when the row has none', () => {
    expect(scrollCostOf({ pergaminho_custo: 777 }, 12, 20, 1)).toBe(777);
    expect(scrollCostOf({ pergaminho_custo: 0 }, 12, 20, 1)).toBe(0);
    expect(scrollCostOf({}, 12, 20, 1)).toBeGreaterThan(0);
    expect(scrollCostOf({}, 9, 20, 1)).toBe(0);
  });
});

async function untilStep(events: ForgeEvent[], count: number): Promise<void> {
  for (let spin = 0; spin < 200; spin++) {
    if (steps(events).length >= count) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`never saw ${String(count)} step(s)`);
}
