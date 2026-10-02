import { describe, expect, it, vi } from 'vitest';
import type { ConsentRecord } from '@bombfarm/contracts';
import {
  CONSENT_TEXT_VERSION,
  PacingRefusedError,
  SessionToken,
  createPacingGate,
  type HttpTransport,
  type PacingGate,
} from '@bombfarm/game-api';
import { createCollectionsReader, type CollectionsReaderDeps } from './collections-reader.js';
import type { CollectionsRecorder } from './collections-recorder.js';
import { createLogSpy } from '../storage/test-support.js';
import { collectionsBody } from './collections-test-support.js';

const GRANTED: ConsentRecord = { decision: 'granted', grantedAt: '2026-10-02T00:00:00.000Z', textVersion: CONSENT_TEXT_VERSION };
const DECLINED: ConsentRecord = { decision: 'declined', textVersion: CONSENT_TEXT_VERSION };

function harness(overrides: Partial<CollectionsReaderDeps> = {}, responseBody: string = JSON.stringify(collectionsBody())) {
  const requests: string[] = [];
  const observed: { body: unknown; atMs: number; accountId?: string }[] = [];
  const transport: HttpTransport = (req) => {
    requests.push(req.path);
    return Promise.resolve({ status: 200, body: responseBody });
  };
  const recorder: CollectionsRecorder = { observe: (observation) => observed.push(observation) };
  let clock = 1_000_000;
  const reader = createCollectionsReader({
    consentStore: { read: () => GRANTED },
    accountSource: () => 'server',
    isGameRunning: () => true,
    readToken: () => ({ ok: true, accountId: '486', token: SessionToken.create('secret-token'), mtimeMs: 0 }),
    transport,
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
  return {
    reader,
    requests,
    observed,
    advance: (ms: number) => {
      clock += ms;
    },
    now: () => clock,
  };
}

async function settle(): Promise<void> {
  for (let i = 0; i < 40; i += 1) await Promise.resolve();
}

describe('collections reader', () => {
  it('asks for the route the client itself uses and hands the body to the recorder as it came', async () => {
    const { reader, requests, observed, now } = harness();
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(requests).toEqual(['/colecao?account_id=486']);
    expect(observed).toEqual([{ body: collectionsBody(), atMs: now(), accountId: '486' }]);
  });

  it('refuses for the same reasons a triggered account read does', () => {
    expect(harness({ accountSource: () => 'fixture' }).reader.refresh()).toEqual({ ok: false, reason: 'offline' });
    expect(harness({ consentStore: { read: () => DECLINED } }).reader.refresh()).toEqual({ ok: false, reason: 'not_consented' });
    expect(harness({ isGameRunning: () => false }).reader.refresh()).toEqual({ ok: false, reason: 'game_not_running' });
    expect(harness({ readToken: () => ({ ok: false, reason: 'not_found' }) }).reader.refresh()).toEqual({
      ok: false,
      reason: 'token_unavailable',
    });
  });

  it('sends no request when it refuses', async () => {
    const { reader, requests } = harness({ accountSource: () => 'fixture' });
    reader.refresh();
    await settle();
    expect(requests).toEqual([]);
  });

  it('holds a floor between two refreshes, so a tab flipped open and shut is one request', async () => {
    const { reader, requests, advance } = harness();
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(reader.refresh()).toEqual({ ok: false, reason: 'rate_limited' });
    advance(10_001);
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(requests).toHaveLength(2);
  });

  it('refuses a second refresh while the first is still in flight', async () => {
    let release: () => void = () => undefined;
    const transport: HttpTransport = () =>
      new Promise((resolve) => {
        release = () => {
          resolve({ status: 200, body: JSON.stringify(collectionsBody()) });
        };
      });
    const { reader, advance } = harness({ transport });
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    advance(60_000);
    expect(reader.refresh()).toEqual({ ok: false, reason: 'rate_limited' });
    release();
    await settle();
    expect(reader.refresh()).toEqual({ ok: true });
  });

  it('hands over a body that carries a key the game added, leaving the recorder to read and flag it', async () => {
    const drifted = { ...collectionsBody(), added_by_a_later_patch: 1 };
    const { reader, observed } = harness({}, JSON.stringify(drifted));
    reader.refresh();
    await settle();
    expect(observed).toHaveLength(1);
    expect(observed[0]?.body).toEqual(drifted);
  });

  it('hands the recorder the account it asked as, so a read that lands after a re-login is not filed under the new one', async () => {
    let token = 'secret-token';
    let accountId = '486';
    const { reader, observed } = harness({
      readToken: () => ({ ok: true, accountId, token: SessionToken.create(token), mtimeMs: 0 }),
    });
    reader.refresh();
    accountId = '11882';
    token = 'another-token';
    await settle();
    expect(observed.map((entry) => entry.accountId)).toEqual(['486']);
  });

  it('survives being paced out, frees the read slot, and still holds the floor', async () => {
    const { log, records } = createLogSpy();
    const refusing: PacingGate = {
      ...createPacingGate({ now: () => 0, sleep: () => Promise.resolve() }),
      run: () => Promise.reject(new PacingRefusedError('halted')),
    };
    const { reader, observed, requests, advance } = harness({ gate: refusing, log });
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(observed).toEqual([]);
    expect(requests).toEqual([]);
    expect(records.some((entry) => entry.level === 'warn' && entry.record['event'] === 'read.paced_out')).toBe(true);

    expect(reader.refresh()).toEqual({ ok: false, reason: 'rate_limited' });
    advance(10_001);
    expect(reader.refresh()).toEqual({ ok: true });
  });

  it('frees the read slot when the recorder throws, and logs the failure', async () => {
    const { log, records } = createLogSpy();
    const throwing: CollectionsRecorder = {
      observe: () => {
        throw new Error('recorder broke');
      },
    };
    const { reader, advance } = harness({ recorder: throwing, log });
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(records.some((entry) => entry.level === 'error' && entry.record['event'] === 'read.threw')).toBe(true);

    advance(10_001);
    expect(reader.refresh()).toEqual({ ok: true });
  });

  it('writes no token and no account id into any log record, whatever the outcome', async () => {
    const { log, records } = createLogSpy();
    const failing = harness({ transport: () => Promise.resolve({ status: 500, body: 'boom' }), log });
    failing.reader.refresh();
    await settle();
    const throwing = harness({
      recorder: {
        observe: () => {
          throw new Error('recorder broke');
        },
      },
      log,
    });
    throwing.reader.refresh();
    await settle();
    const ok = harness({ log });
    ok.reader.refresh();
    await settle();

    expect(records.length).toBeGreaterThan(0);
    const written = JSON.stringify(records);
    expect(written).not.toContain('secret-token');
    expect(written).not.toContain('486');
  });

  it('records nothing from a failed read, and does not throw', async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const { reader, observed } = harness({ transport: () => Promise.resolve({ status: 500, body: 'boom' }), log });
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(observed).toEqual([]);
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ scope: 'collections', event: 'read.failed' }));
  });
});
