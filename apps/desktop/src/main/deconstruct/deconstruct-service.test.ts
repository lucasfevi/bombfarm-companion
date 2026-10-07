import { describe, expect, it } from 'vitest';
import type {
  AccountReadResult,
  DeconstructEvent,
  DeconstructRunResult,
  DeconstructStartReason,
} from '@bombfarm/contracts';
import {
  SessionToken,
  createPacingGate,
  type ConsentRecord,
  type HttpRequest,
  type HttpResponse,
  type HttpWriteRequest,
  type HttpTransport,
  type PacingGate,
} from '@bombfarm/game-api';
import { consentRecord, grantedConsent } from '@bombfarm/game-api/test-fixtures';
import { createWriterLock } from '../apply/writer-lock.js';
import type { DeconstructAccountPatch } from './deconstruct-account-patch.js';
import { createDeconstructService, type DeconstructServiceDeps } from './deconstruct-service.js';

const GRANTED = grantedConsent('2026-10-05T10:00:00.000Z');
const ROWS = ['90017', '90018', '90019', '90020'].map((id) => ({ id, def_id: 'steel_luva' }));
const REQUEST = { itemIds: ['90017', '90018', '90019'] };

type Reply = { status: number; body: string; hold?: boolean } | { throws: string };

function scriptedTransport(script: Reply[]) {
  const calls: (HttpRequest | HttpWriteRequest)[] = [];
  const pending: (() => void)[] = [];
  const transport: HttpTransport = (req) => {
    calls.push(req);
    const reply = script.shift();
    if (!reply) throw new Error(`no scripted reply for call ${String(calls.length)}`);
    if ('throws' in reply) return Promise.reject(new Error(reply.throws));
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

const BURNED_BODY = JSON.stringify({ essence: 102_570, queimados: 3, ganho: 90 });

function harness(overrides: Partial<DeconstructServiceDeps> & { script?: Reply[]; consent?: ConsentRecord } = {}) {
  const wire = scriptedTransport(overrides.script ?? [{ status: 200, body: BURNED_BODY }]);
  const events: DeconstructEvent[] = [];
  const timeline: string[] = [];
  const applied: DeconstructAccountPatch[] = [];
  const logs: Record<string, unknown>[] = [];
  const reads: AccountReadResult[] = [];
  const gate = overrides.gate ?? immediateGate();
  const writerLock = overrides.writerLock ?? createWriterLock();
  let clock = 1_000;
  const deps: DeconstructServiceDeps = {
    consentStore: { read: () => overrides.consent ?? GRANTED },
    readToken: () => ({ ok: true, accountId: '486', token: SessionToken.create('sentinel-deconstruct-do-not-leak'), mtimeMs: 1 }),
    settings: () => ({ forgeWritesEnabled: true }),
    transport: wire.transport,
    gate,
    accountSource: () => 'server',
    isGameRunning: () => true,
    currentItems: () => ROWS,
    applyResult: (patch) => {
      timeline.push('apply');
      applied.push(patch);
    },
    writerLock,
    requestReadNow: () => {
      timeline.push('read');
      const result: AccountReadResult = { ok: true };
      reads.push(result);
      return result;
    },
    emit: (event) => {
      timeline.push('done');
      events.push(event);
    },
    log: {
      info: (record) => logs.push(record),
      warn: (record) => logs.push(record),
      error: (record) => logs.push(record),
    },
    now: () => (clock += 10),
    random: () => 0.5,
    ...overrides,
  };
  const service = createDeconstructService(deps);
  return { service, wire, events, timeline, applied, logs, reads, gate, writerLock };
}

async function untilDone(events: DeconstructEvent[]): Promise<DeconstructEvent> {
  for (let spin = 0; spin < 200; spin++) {
    const done = events[0];
    if (done) return done;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error('the run never finished');
}

async function settled(h: ReturnType<typeof harness>, request: unknown = REQUEST): Promise<DeconstructEvent> {
  const started = h.service.start(request);
  if (!started.ok) throw new Error(`did not start: ${started.reason}`);
  return untilDone(h.events);
}

describe('refusals', () => {
  const FAULTS: { reason: DeconstructStartReason; overrides: Partial<DeconstructServiceDeps> & { consent?: ConsentRecord } }[] = [
    { reason: 'busy', overrides: { writerLock: heldBy('apply') } },
    { reason: 'offline', overrides: { accountSource: () => 'fixture' } },
    { reason: 'unknown_item', overrides: { currentItems: () => [] } },
    { reason: 'not_consented', overrides: { consent: consentRecord({ decision: 'declined' }) } },
    { reason: 'game_not_running', overrides: { isGameRunning: () => false } },
    { reason: 'token_unavailable', overrides: { readToken: () => ({ ok: false, reason: 'not_found' }) } },
    { reason: 'writes_disabled', overrides: { settings: () => ({ forgeWritesEnabled: false }) } },
  ];

  function heldBy(owner: string) {
    const lock = createWriterLock();
    lock.acquire(owner);
    return lock;
  }

  it('answers each reason on its own, sends nothing, and leaves no lock or run behind', () => {
    for (const { reason, overrides } of FAULTS) {
      const h = harness(overrides);
      const writerHeldBefore = h.writerLock.holder;
      expect(h.service.start(REQUEST), reason).toEqual({ ok: false, reason });
      expect(h.wire.calls, reason).toHaveLength(0);
      expect(h.service.isRunning(), reason).toBe(false);
      expect(h.writerLock.holder, reason).toBe(writerHeldBefore);
      expect(h.timeline, reason).toEqual([]);
    }
  });

  it('checks them in order: bad_request, busy, offline, unknown_item, not_consented, game_not_running, token_unavailable, writes_disabled', () => {
    const everythingWrong = (from: number): Partial<DeconstructServiceDeps> & { consent?: ConsentRecord } =>
      Object.assign({}, ...FAULTS.slice(from).map((fault) => fault.overrides)) as Partial<DeconstructServiceDeps>;

    expect(harness(everythingWrong(0)).service.start({ itemIds: [] })).toEqual({ ok: false, reason: 'bad_request' });
    for (const [index, { reason }] of FAULTS.entries()) {
      expect(harness(everythingWrong(index)).service.start(REQUEST), reason).toEqual({ ok: false, reason });
    }
  });

  it('refuses a request the renderer should never send as bad_request: empty, duplicated, oversized, non-numeric, or not an object', () => {
    const tooMany = Array.from({ length: 101 }, (_, index) => String(90_000 + index));
    const bad: unknown[] = [
      undefined,
      null,
      'nope',
      {},
      { itemIds: [] },
      { itemIds: ['90017', '90017'] },
      { itemIds: tooMany },
      { itemIds: ['90017', 'abc'] },
      { itemIds: [90017] },
      { itemIds: '90017' },
    ];
    for (const request of bad) {
      const h = harness();
      expect(h.service.start(request), JSON.stringify(request)).toEqual({ ok: false, reason: 'bad_request' });
      expect(h.wire.calls).toHaveLength(0);
    }
  });

  it('refuses unknown_item when any one id of the batch is missing from the bag, even if the others are present', () => {
    const h = harness();
    expect(h.service.start({ itemIds: ['90017', '99999'] })).toEqual({ ok: false, reason: 'unknown_item' });
    expect(h.wire.calls).toHaveLength(0);
  });

  it('refuses unknown_item when the account has no items section at all', () => {
    const h = harness({ currentItems: () => null });
    expect(h.service.start(REQUEST)).toEqual({ ok: false, reason: 'unknown_item' });
  });

  it('does not judge eligibility: a row marked locked or worn still goes to the server, which is the authority', async () => {
    const rows = [{ id: '90017', locked: true }, { id: '90018', equipped_on: 'h1' }, { id: '90019', in_stash: true }];
    const h = harness({ currentItems: () => rows, script: [{ status: 400, body: '{"error":"ITEM_USER_LOCKED"}' }] });
    const done = await settled(h);
    expect(h.wire.calls).toHaveLength(1);
    expect(done).toMatchObject({ result: { status: 'refused', code: 'ITEM_USER_LOCKED' } });
  });

  it('answers busy while its own run is in flight, and accepts the next request once that run is done', async () => {
    const h = harness({ script: [{ status: 200, body: BURNED_BODY, hold: true }, { status: 200, body: BURNED_BODY }] });
    const first = h.service.start(REQUEST);
    expect(first.ok).toBe(true);
    expect(h.service.isRunning()).toBe(true);
    expect(h.service.start({ itemIds: ['90020'] })).toEqual({ ok: false, reason: 'busy' });
    for (let spin = 0; spin < 50 && h.wire.pendingCount() === 0; spin++) await new Promise((resolve) => setImmediate(resolve));
    h.wire.release();
    await untilDone(h.events);
    h.events.length = 0;
    expect(h.service.start({ itemIds: ['90020'] }).ok).toBe(true);
    await untilDone(h.events);
  });
});

describe('the request', () => {
  it('is one POST to the deconstruct route with the account, the comma-joined ids and a request id, and nothing else', async () => {
    const h = harness();
    await settled(h);
    expect(h.wire.calls).toHaveLength(1);
    const call = h.wire.calls[0];
    expect(call?.method).toBe('POST');
    expect(call?.host).toBe('app.bombfarm.net');
    expect(call?.path).toMatch(/^\/item\/desconstruir\?account_id=486&items=90017,90018,90019&request_id=c\d+-1-500000$/);
    expect(call?.headers['Content-Length']).toBe('0');
  });

  it('gives every run a request id of its own, in the game\'s sequence', async () => {
    const h = harness({ script: [{ status: 200, body: BURNED_BODY }, { status: 200, body: BURNED_BODY }] });
    await settled(h);
    h.events.length = 0;
    await settled(h, { itemIds: ['90020'] });
    const ids = h.wire.calls.map((call) => /request_id=(.+)$/.exec(call.path)?.[1]);
    expect(ids[0]).toMatch(/^c\d+-1-/);
    expect(ids[1]).toMatch(/^c\d+-2-/);
  });

  it('is never sent twice, whatever came back — a destroyed batch is never retried', async () => {
    const answers: Reply[] = [
      { status: 429, body: '{"error":"RATE_LIMIT"}' },
      { status: 503, body: '' },
      { status: 500, body: '' },
      { status: 200, body: 'not json' },
      { throws: 'socket hang up' },
      { status: 401, body: '' },
      { status: 400, body: '{"error":"ITEM_LOCKED"}' },
      { status: 200, body: '{}' },
    ];
    for (const answer of answers) {
      const h = harness({ script: [answer, { status: 200, body: BURNED_BODY }] });
      await settled(h);
      for (let spin = 0; spin < 20; spin++) await new Promise((resolve) => setImmediate(resolve));
      expect(h.wire.calls, JSON.stringify(answer)).toHaveLength(1);
    }
  });
});

describe('what a run settles as', () => {
  async function resultOf(reply: Reply): Promise<DeconstructRunResult> {
    const done = await settled(harness({ script: [reply] }));
    return done.result;
  }

  it('reads the burned count, the gain and the new balance off a success', async () => {
    expect(await resultOf({ status: 200, body: JSON.stringify({ essence: 102_570, queimados: 2, ganho: 90 }) })).toEqual({
      status: 'burned',
      burned: 2,
      gained: 90,
      essence: 102_570,
    });
  });

  it('counts the whole batch as burned when the count is missing, since a 200 with a balance means the batch burned, and a missing gain as zero', async () => {
    expect(await resultOf({ status: 200, body: '{"essence":7}' })).toEqual({ status: 'burned', burned: 3, gained: 0, essence: 7 });
  });

  it('falls back to those defaults when the count or the gain is not a non-negative integer', async () => {
    expect(await resultOf({ status: 200, body: '{"essence":7,"queimados":-1,"ganho":1.5}' })).toEqual({
      status: 'burned',
      burned: 3,
      gained: 0,
      essence: 7,
    });
    expect(await resultOf({ status: 200, body: '{"essence":7,"queimados":"2","ganho":"9"}' })).toEqual({
      status: 'burned',
      burned: 3,
      gained: 0,
      essence: 7,
    });
  });

  it('accepts a zero balance and a zero burn count', async () => {
    expect(await resultOf({ status: 200, body: '{"essence":0,"queimados":0,"ganho":0}' })).toEqual({
      status: 'burned',
      burned: 0,
      gained: 0,
      essence: 0,
    });
  });

  it('treats a 200 without a usable balance as unreadable, never as a burn', async () => {
    for (const body of ['{}', '{"queimados":3,"ganho":90}', '{"essence":"102570"}', '{"essence":-1}', '{"essence":1.5}', '{"essence":null}', '[]', '3']) {
      expect(await resultOf({ status: 200, body }), body).toEqual({ status: 'failed', reason: 'unreadable' });
    }
  });

  it('carries a named refusal through as its code, on a 4xx and on a 200', async () => {
    expect(await resultOf({ status: 400, body: '{"error":"ITEM_EQUIPPED"}' })).toEqual({ status: 'refused', code: 'ITEM_EQUIPPED' });
    expect(await resultOf({ status: 200, body: '{"error":"BURN_BATCH_TOO_BIG"}' })).toEqual({ status: 'refused', code: 'BURN_BATCH_TOO_BIG' });
    expect(await resultOf({ status: 409, body: '{"error":"SOMETHING_NEW"}' })).toEqual({ status: 'refused', code: 'SOMETHING_NEW' });
  });

  it('settles the import-cooldown refusal as refused with its code, and leaves the gate ready', async () => {
    for (const status of [200, 400]) {
      const h = harness({ script: [{ status, body: '{"error":"ITEM_IMPORT_COOLDOWN"}' }] });
      const done = await settled(h);
      expect(done.result, String(status)).toEqual({ status: 'refused', code: 'ITEM_IMPORT_COOLDOWN' });
      expect(h.gate.state, String(status)).toBe('ready');
      expect(h.applied).toEqual([]);
    }
  });

  it('settles a rejected token as session, whether by status or by a dead-session code', async () => {
    expect(await resultOf({ status: 401, body: '' })).toEqual({ status: 'failed', reason: 'session' });
    expect(await resultOf({ status: 200, body: '{"error":"SESSION_EXPIRED"}' })).toEqual({ status: 'failed', reason: 'session' });
  });

  it('settles a rate limit as cooldown', async () => {
    expect(await resultOf({ status: 429, body: '{"error":"RATE_LIMIT"}' })).toEqual({ status: 'failed', reason: 'cooldown' });
  });

  it('settles a dropped connection and a server error as network', async () => {
    expect(await resultOf({ throws: 'socket hang up' })).toEqual({ status: 'failed', reason: 'network' });
    expect(await resultOf({ status: 502, body: '<html>bad gateway</html>' })).toEqual({ status: 'failed', reason: 'network' });
  });

  it('settles a body that is not JSON as unreadable', async () => {
    expect(await resultOf({ status: 200, body: '<html>maintenance</html>' })).toEqual({ status: 'failed', reason: 'unreadable' });
  });

  it('feeds the gate the outcome: a cooldown opens its backoff and a rejected token halts it', async () => {
    const cooled = harness({ script: [{ status: 429, body: '{"error":"RATE_LIMIT"}' }] });
    await settled(cooled);
    expect(cooled.gate.state).toEqual({ backoffUntil: 60_000 });

    const rejected = harness({ script: [{ status: 401, body: '' }] });
    await settled(rejected);
    expect(rejected.gate.state).toBe('halted');
  });

  it('settles as cooldown without sending when the gate is in a backoff window, and as session when it is halted', async () => {
    const cooling = immediateGate();
    cooling.observe({ kind: 'cooldown' });
    const inBackoff = harness({ gate: cooling });
    expect((await settled(inBackoff)).result).toEqual({ status: 'failed', reason: 'cooldown' });
    expect(inBackoff.wire.calls).toHaveLength(0);

    const halted = immediateGate();
    halted.observe({ kind: 'unauthorized' });
    const dead = harness({ gate: halted });
    expect((await settled(dead)).result).toEqual({ status: 'failed', reason: 'session' });
    expect(dead.wire.calls).toHaveLength(0);
  });

  it('settles as error when anything else throws on the way', async () => {
    const gate: PacingGate = { ...immediateGate(), runWrite: () => Promise.reject(new Error('boom')) };
    const h = harness({ gate });
    expect((await settled(h)).result).toEqual({ status: 'failed', reason: 'error' });
    expect(h.wire.calls).toHaveLength(0);
    expect(h.writerLock.holder).toBeNull();
  });
});

describe('after a run', () => {
  it('emits one done event naming the run and the batch it was asked to burn', async () => {
    const h = harness();
    const started = h.service.start(REQUEST);
    if (!started.ok) throw new Error('did not start');
    const done = await untilDone(h.events);
    expect(h.events).toHaveLength(1);
    expect(done).toEqual({
      type: 'done',
      runId: started.runId,
      itemIds: REQUEST.itemIds,
      result: { status: 'burned', burned: 3, gained: 90, essence: 102_570 },
    });
  });

  it('holds the writer lock for the run and releases it before the next start can be asked', async () => {
    const h = harness({ script: [{ status: 200, body: BURNED_BODY, hold: true }] });
    expect(h.writerLock.holder).toBeNull();
    h.service.start(REQUEST);
    expect(h.writerLock.holder).toBe('deconstruct');
    for (let spin = 0; spin < 50 && h.wire.pendingCount() === 0; spin++) await new Promise((resolve) => setImmediate(resolve));
    h.wire.release();
    await untilDone(h.events);
    expect(h.writerLock.holder).toBeNull();
    expect(h.service.isRunning()).toBe(false);
  });

  it('releases the lock, clears the run and emits done on every path', async () => {
    const replies: Reply[] = [
      { status: 200, body: BURNED_BODY },
      { status: 200, body: '{}' },
      { status: 400, body: '{"error":"ITEM_HAS_GEMS"}' },
      { status: 401, body: '' },
      { status: 429, body: '{"error":"RATE_LIMIT"}' },
      { throws: 'socket hang up' },
    ];
    for (const reply of replies) {
      const h = harness({ script: [reply] });
      await settled(h);
      expect(h.writerLock.holder, JSON.stringify(reply)).toBeNull();
      expect(h.service.isRunning(), JSON.stringify(reply)).toBe(false);
      expect(h.events, JSON.stringify(reply)).toHaveLength(1);
    }
  });

  it('removes the burned batch from the account and lays the new balance over it, then re-reads, before announcing done', async () => {
    const h = harness();
    await settled(h);
    expect(h.applied).toEqual([{ itemIds: REQUEST.itemIds, essence: 102_570 }]);
    expect(h.timeline).toEqual(['apply', 'read', 'done']);
  });

  it('patches in the balance the server reported, whatever count it says it burned', async () => {
    const h = harness({ script: [{ status: 200, body: '{"essence":55,"queimados":1,"ganho":4}' }] });
    await settled(h);
    expect(h.applied).toEqual([{ itemIds: REQUEST.itemIds, essence: 55 }]);
  });

  it('only re-reads after a refusal: nothing was burned, so nothing is patched', async () => {
    const h = harness({ script: [{ status: 400, body: '{"error":"ITEM_EQUIPPED"}' }] });
    await settled(h);
    expect(h.applied).toEqual([]);
    expect(h.timeline).toEqual(['read', 'done']);
  });

  it('only re-reads after any failure, since the write may or may not have landed', async () => {
    const replies: Reply[] = [
      { status: 200, body: '{}' },
      { status: 401, body: '' },
      { status: 429, body: '{"error":"RATE_LIMIT"}' },
      { status: 500, body: '' },
      { throws: 'socket hang up' },
      { status: 200, body: 'not json' },
    ];
    for (const reply of replies) {
      const h = harness({ script: [reply] });
      await settled(h);
      expect(h.applied, JSON.stringify(reply)).toEqual([]);
      expect(h.timeline, JSON.stringify(reply)).toEqual(['read', 'done']);
    }
  });

  it('re-reads even when the gate refused the call and nothing was sent', async () => {
    const cooling = immediateGate();
    cooling.observe({ kind: 'cooldown' });
    const h = harness({ gate: cooling });
    await settled(h);
    expect(h.timeline).toEqual(['read', 'done']);
  });

  it('still re-reads and still announces done when patching the account throws', async () => {
    const h = harness({
      applyResult: () => {
        throw new Error('store closed');
      },
    });
    const done = await settled(h);
    expect(done).toMatchObject({ result: { status: 'burned', essence: 102_570 } });
    expect(h.reads).toHaveLength(1);
    expect(h.logs.some((record) => record.event === 'run.apply_failed')).toBe(true);
  });

  it('still announces done, and keeps the burn, when the re-read throws or is refused', async () => {
    const throwing = harness({
      requestReadNow: () => {
        throw new Error('no reader');
      },
    });
    expect(await settled(throwing)).toMatchObject({ result: { status: 'burned' } });
    expect(throwing.writerLock.holder).toBeNull();

    const refused = harness({ requestReadNow: () => ({ ok: false, reason: 'rate_limited' }) });
    expect(await settled(refused)).toMatchObject({ result: { status: 'burned' } });
    expect(refused.logs).toContainEqual(expect.objectContaining({ event: 'run.read_now_refused', reason: 'rate_limited' }));
  });
});

describe('logging', () => {
  it('names each stage with the deconstruct scope and counts the batch without ever listing it', async () => {
    const h = harness();
    await settled(h);
    expect(h.logs).toEqual([
      expect.objectContaining({ scope: 'deconstruct', event: 'run.started', items: 3 }),
      expect.objectContaining({ scope: 'deconstruct', event: 'run.finished', items: 3, status: 'burned', burned: 3, gained: 90 }),
    ]);
    const text = JSON.stringify(h.logs);
    for (const id of REQUEST.itemIds) expect(text).not.toContain(id);
    expect(text).not.toContain('sentinel-deconstruct-do-not-leak');
  });

  it('logs a refusal with its reason, and a refused run with its code', async () => {
    const declined = harness({ consent: consentRecord({ decision: 'declined' }) });
    declined.service.start(REQUEST);
    expect(declined.logs).toEqual([{ scope: 'deconstruct', event: 'run.refused', reason: 'not_consented' }]);

    const refused = harness({ script: [{ status: 400, body: '{"error":"ITEM_LOCKED"}' }] });
    await settled(refused);
    expect(refused.logs).toContainEqual(
      expect.objectContaining({ scope: 'deconstruct', event: 'run.finished', status: 'refused', code: 'ITEM_LOCKED' }),
    );
  });
});
