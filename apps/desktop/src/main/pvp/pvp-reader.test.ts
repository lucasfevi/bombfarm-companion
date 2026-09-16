import { describe, expect, it, vi } from 'vitest';
import type { ConsentRecord } from '@bombfarm/contracts';
import { CONSENT_TEXT_VERSION, SessionToken, createPacingGate, type HttpTransport } from '@bombfarm/game-api';
import { createPvpReader, type PvpReaderDeps } from './pvp-reader.js';
import type { PvpRecorder } from './pvp-recorder.js';

const GRANTED: ConsentRecord = { decision: 'granted', grantedAt: '2026-09-16T00:00:00.000Z', textVersion: CONSENT_TEXT_VERSION };
const DECLINED: ConsentRecord = { decision: 'declined', textVersion: CONSENT_TEXT_VERSION };

function stateBody(points: number): string {
  return JSON.stringify({ pontos: points, faixa: 'r2', fase: 50, faixa_num: 2, faixa_prox: 375, slots: 9, squad: [], duelos_usados: 8, duelos_max: 10 });
}

function rankingBody(): string {
  return JSON.stringify({ by: 'pvp', top: [], me: { rank: 2, name: 'Me', value: '205' } });
}

function harness(overrides: Partial<PvpReaderDeps> = {}) {
  const requests: string[] = [];
  const observed: { route: string; body: unknown }[] = [];
  const transport: HttpTransport = (req) => {
    requests.push(req.path);
    const body = req.path.startsWith('/pvp/state') ? stateBody(205) : rankingBody();
    return Promise.resolve({ status: 200, body });
  };
  const recorder: PvpRecorder = { observe: (observation) => observed.push({ route: observation.route, body: observation.body }) };
  let clock = 1_000_000;
  const reader = createPvpReader({
    consentStore: { read: () => GRANTED },
    accountSource: () => 'server',
    isGameRunning: () => true,
    readToken: () => ({ ok: true, accountId: '486', token: SessionToken.create('secret-token'), mtimeMs: 0 }),
    transport,
    // The gate spaces the two reads 1.1 s apart by sleeping; the sleep moves this clock instead.
    gate: createPacingGate({
      now: () => clock,
      sleep: (ms) => {
        clock += ms;
        return Promise.resolve();
      },
    }),
    recorder,
    now: () => clock,
    ...overrides,
  });
  return { reader, requests, observed, advance: (ms: number) => { clock += ms; } };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

describe('pvp reader', () => {
  it('asks for the state and the points ranking on the routes the client itself uses, and feeds both to the recorder', async () => {
    const { reader, requests, observed } = harness();
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(requests).toEqual(['/pvp/state?account_id=486', '/ranking?by=pvp&limit=100&account_id=486']);
    expect(observed.map((entry) => entry.route)).toEqual(['state', 'ranking']);
  });

  it('refuses for the same reasons a triggered account read does', () => {
    expect(harness({ accountSource: () => 'fixture' }).reader.refresh()).toEqual({ ok: false, reason: 'offline' });
    expect(harness({ consentStore: { read: () => DECLINED } }).reader.refresh()).toEqual({ ok: false, reason: 'not_consented' });
    expect(harness({ isGameRunning: () => false }).reader.refresh()).toEqual({ ok: false, reason: 'game_not_running' });
    expect(harness({ readToken: () => ({ ok: false, reason: 'not_found' }) }).reader.refresh()).toEqual({ ok: false, reason: 'token_unavailable' });
  });

  it('holds a floor between two refreshes, so a tab flipped open and shut is one pair of requests', async () => {
    const { reader, requests, advance } = harness();
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(reader.refresh()).toEqual({ ok: false, reason: 'rate_limited' });
    advance(10_001);
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(requests).toHaveLength(4);
  });

  it('records nothing from a failed read, and does not throw', async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const { reader, observed } = harness({ transport: () => Promise.resolve({ status: 500, body: 'boom' }), log });
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(observed).toEqual([]);
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'read.failed', route: 'state' }));
  });
});
