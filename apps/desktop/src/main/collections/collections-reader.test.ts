import { describe, expect, it, vi } from 'vitest';
import type { ConsentRecord } from '@bombfarm/contracts';
import { CONSENT_TEXT_VERSION, SessionToken, createPacingGate, type HttpTransport } from '@bombfarm/game-api';
import { createCollectionsReader, type CollectionsReaderDeps } from './collections-reader.js';
import type { CollectionsRecorder } from './collections-recorder.js';
import { collectionsBody } from './collections-test-support.js';

const GRANTED: ConsentRecord = { decision: 'granted', grantedAt: '2026-10-02T00:00:00.000Z', textVersion: CONSENT_TEXT_VERSION };
const DECLINED: ConsentRecord = { decision: 'declined', textVersion: CONSENT_TEXT_VERSION };

function harness(overrides: Partial<CollectionsReaderDeps> = {}, responseBody: string = JSON.stringify(collectionsBody())) {
  const requests: string[] = [];
  const observed: { body: unknown; atMs: number }[] = [];
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
    expect(observed).toEqual([{ body: collectionsBody(), atMs: now() }]);
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

  it('records nothing from a failed read, and does not throw', async () => {
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const { reader, observed } = harness({ transport: () => Promise.resolve({ status: 500, body: 'boom' }), log });
    expect(reader.refresh()).toEqual({ ok: true });
    await settle();
    expect(observed).toEqual([]);
    expect(log.warn).toHaveBeenCalledWith(expect.objectContaining({ scope: 'collections', event: 'read.failed' }));
  });
});
