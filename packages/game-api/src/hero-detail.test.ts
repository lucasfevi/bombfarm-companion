import { describe, expect, it, vi } from 'vitest';
import { HERO_DETAIL_PATH, heroDetailPath, readHeroDetail } from './hero-detail.js';
import { PacingRefusedError, type PacingGate, type PacingState } from './pacing.js';
import type { HttpResponse, HttpTransport } from './request.js';
import { SessionToken, grantSession } from './session.js';
import { grantedConsent } from './test-fixtures.js';

const GRANTED = grantedConsent('2026-08-12T13:15:38.000Z');
const session = grantSession(GRANTED, { accountId: '486', token: SessionToken.create('sentinel-hero-detail') });

function fixedResponseTransport(response: HttpResponse): HttpTransport {
  return () => Promise.resolve(response);
}

/** A spy gate that runs `fn` immediately (no pacing) and records every `observe` call. */
function passthroughGate(): PacingGate & { observeCalls: unknown[] } {
  const observeCalls: unknown[] = [];
  return {
    observeCalls,
    async run<T>(_key: string, fn: () => Promise<T>): Promise<T> {
      return fn();
    },
    async runWrite<T>(_key: string, fn: () => Promise<T>): Promise<T> {
      return fn();
    },
    nextForgeDelayMs: () => 0,
    observe(outcome) {
      observeCalls.push(outcome);
    },
    state: 'ready',
    nextCycleDelayMs: () => 0,
    resetAuth() {},
  };
}

/** A gate whose `run` always refuses with the given state, never invoking `fn`. */
function refusingGate(gateState: PacingState): PacingGate & { observeCalls: unknown[] } {
  const observeCalls: unknown[] = [];
  return {
    observeCalls,
    run<T>(): Promise<T> {
      return Promise.reject(new PacingRefusedError(gateState));
    },
    runWrite<T>(): Promise<T> {
      return Promise.reject(new PacingRefusedError(gateState));
    },
    nextForgeDelayMs: () => 0,
    observe(outcome) {
      observeCalls.push(outcome);
    },
    state: gateState,
    nextCycleDelayMs: () => 0,
    resetAuth() {},
  };
}

describe('heroDetailPath', () => {
  it('carries the encoded hero id after the fixed path', () => {
    expect(heroDetailPath('hero 7/ä')).toBe(`${HERO_DETAIL_PATH}?hero=hero%207%2F%C3%A4`);
  });
});

describe('readHeroDetail — the happy path', () => {
  it('reads alloc, spent, available and a string respec_gold_cost', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({
      status: 200,
      body: JSON.stringify({
        alloc: [1, 2, 3, 4, 5, 6, 7, 8],
        stat_points_spent: 36,
        stat_points_available: 4,
        respec_gold_cost: '100000',
      }),
    });
    const reading = await readHeroDetail(session, transport, gate, 'hero-1');
    expect(reading).toEqual({ kind: 'ok', alloc: [1, 2, 3, 4, 5, 6, 7, 8], spent: 36, available: 4, respecGold: 100_000 });
  });

  it('reads a numeric respec_gold_cost directly', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({
      status: 200,
      body: JSON.stringify({ alloc: [0, 0, 0, 0, 0, 0, 0, 0], stat_points_spent: 0, respec_gold_cost: 5000 }),
    });
    const reading = await readHeroDetail(session, transport, gate, 'hero-1');
    expect(reading).toMatchObject({ kind: 'ok', respecGold: 5000 });
  });

  it('reads missing optionals as null', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({
      status: 200,
      body: JSON.stringify({ alloc: [0, 0, 0, 0, 0, 0, 0, 0], stat_points_spent: 0 }),
    });
    const reading = await readHeroDetail(session, transport, gate, 'hero-1');
    expect(reading).toEqual({ kind: 'ok', alloc: [0, 0, 0, 0, 0, 0, 0, 0], spent: 0, available: null, respecGold: null });
  });

  it('the GET path carries hero then account_id', async () => {
    const gate = passthroughGate();
    const transport = vi.fn().mockResolvedValue({
      status: 200,
      body: JSON.stringify({ alloc: [0, 0, 0, 0, 0, 0, 0, 0], stat_points_spent: 0 }),
    }) as HttpTransport & ReturnType<typeof vi.fn>;
    await readHeroDetail(session, transport, gate, 'hero-1');
    const req = transport.mock.calls[0]?.[0] as { path: string };
    expect(req.path).toBe('/hero/detail?hero=hero-1&account_id=486');
  });

  it('gate.observe is called exactly once for a settled outcome', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({
      status: 200,
      body: JSON.stringify({ alloc: [0, 0, 0, 0, 0, 0, 0, 0], stat_points_spent: 0 }),
    });
    await readHeroDetail(session, transport, gate, 'hero-1');
    expect(gate.observeCalls).toHaveLength(1);
  });
});

describe('readHeroDetail — bad_shape', () => {
  const cases: readonly [string, unknown][] = [
    ['a seven-element alloc', { alloc: [1, 2, 3, 4, 5, 6, 7], stat_points_spent: 0 }],
    ['a non-integer alloc element', { alloc: [1, 2, 3, 4, 5, 6, 7, 1.5], stat_points_spent: 0 }],
    ['a negative alloc element', { alloc: [1, 2, 3, 4, 5, 6, 7, -1], stat_points_spent: 0 }],
    ['alloc absent', { stat_points_spent: 0 }],
    ['stat_points_spent absent', { alloc: [0, 0, 0, 0, 0, 0, 0, 0] }],
  ];

  it.each(cases)('%s', async (_label, body) => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({ status: 200, body: JSON.stringify(body) });
    const reading = await readHeroDetail(session, transport, gate, 'hero-1');
    expect(reading).toEqual({ kind: 'failed', reason: 'bad_shape' });
  });
});

describe('readHeroDetail — every other failure reason', () => {
  it('cooldown on 429', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({ status: 429, body: '' });
    expect(await readHeroDetail(session, transport, gate, 'hero-1')).toEqual({ kind: 'failed', reason: 'cooldown' });
  });

  it('unauthorized on 401', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({ status: 401, body: '' });
    expect(await readHeroDetail(session, transport, gate, 'hero-1')).toEqual({ kind: 'failed', reason: 'unauthorized' });
  });

  it('api_error carries the server code', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({ status: 400, body: '{"error":"NO_SUCH_HERO"}' });
    expect(await readHeroDetail(session, transport, gate, 'hero-1')).toEqual({
      kind: 'failed',
      reason: 'api_error',
      code: 'NO_SUCH_HERO',
    });
  });

  it('http_error carries the status', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({ status: 404, body: 'not found' });
    expect(await readHeroDetail(session, transport, gate, 'hero-1')).toEqual({
      kind: 'failed',
      reason: 'http_error',
      status: 404,
    });
  });

  it('malformed_json on an unparseable 200 body', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({ status: 200, body: 'not json' });
    expect(await readHeroDetail(session, transport, gate, 'hero-1')).toEqual({ kind: 'failed', reason: 'malformed_json' });
  });

  it('too_large on an oversized body', async () => {
    const gate = passthroughGate();
    const transport = fixedResponseTransport({ status: 200, body: 'x'.repeat(2_000_001) });
    expect(await readHeroDetail(session, transport, gate, 'hero-1')).toEqual({ kind: 'failed', reason: 'too_large' });
  });

  it('transport_error when the transport throws', async () => {
    const gate = passthroughGate();
    const transport: HttpTransport = () => Promise.reject(new Error('socket hang up'));
    expect(await readHeroDetail(session, transport, gate, 'hero-1')).toEqual({
      kind: 'failed',
      reason: 'transport_error',
    });
  });

  it("the gate's own backoff window reads cooldown", async () => {
    const gate = refusingGate({ backoffUntil: 1_000 });
    const transport: HttpTransport = () => Promise.reject(new Error('never called'));
    expect(await readHeroDetail(session, transport, gate, 'hero-1')).toEqual({ kind: 'failed', reason: 'cooldown' });
  });

  it("the gate's halted state reads unauthorized", async () => {
    const gate = refusingGate('halted');
    const transport: HttpTransport = () => Promise.reject(new Error('never called'));
    expect(await readHeroDetail(session, transport, gate, 'hero-1')).toEqual({ kind: 'failed', reason: 'unauthorized' });
  });
});
