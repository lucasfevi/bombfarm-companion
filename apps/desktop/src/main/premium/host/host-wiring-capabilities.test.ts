import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PREMIUM_CAPABILITIES } from '@bombfarm/contracts';
import { appLeaseGate } from '../licence/lease-gate';
import type { Parse, SealedRows } from '../licence/licence-store';
import { createLogSink } from '../premium-test-support';
import { createBundleCache } from './bundle-cache';
import { createFakeFork } from './host-fakes';
import { flush, workerOptions } from './host-service-test-support';
import { HOST_NOW, verifiedFixture } from './host-test-support';
import { createPremiumHost, type PremiumHostCapabilityDeps, type PremiumHostWiringDeps } from './host-wiring';
import type { HostRunner } from './host-runner';

// The dev-only reader is reached by `require` in the built app, which plain Node cannot do for this
// source; the test reads the folder with the same function through the test bundler instead.
vi.mock('./dev-loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dev-loader')>();
  const { readLocalBundle } = await import('./dev-bundle.js');
  return { ...actual, loadLocalBundle: readLocalBundle };
});

const SUBJECT = 'subject-marker-0001';
const SEQUENCE = 6;

let root = '';
let hosts: HostRunner[] = [];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'bfc-host-caps-'));
  hosts = [];
  appLeaseGate.set(false, 'signed_out');
  (globalThis as unknown as { __bfcTestHost?: unknown }).__bfcTestHost = undefined;
});

afterEach(async () => {
  for (const host of hosts) {
    host.stop();
    await host.idle();
  }
  appLeaseGate.set(false, 'signed_out');
  (globalThis as unknown as { __bfcTestHost?: unknown }).__bfcTestHost = undefined;
  await rm(root, { recursive: true, force: true });
});

type MemoryRows = SealedRows & { held: Map<string, string> };

function memoryRows(): MemoryRows {
  const held = new Map<string, string>();
  return {
    held,
    available: () => true,
    read: <T>(key: string, parse: Parse<T>): T | null => {
      const stored = held.get(key);
      return stored === undefined ? null : parse(JSON.parse(stored) as Record<string, unknown>);
    },
    write: (key, json) => {
      held.set(key, json());
      return 'written';
    },
    delete: (key) => {
      held.delete(key);
      return true;
    },
  };
}

function capabilities(rows: SealedRows): PremiumHostCapabilityDeps {
  return {
    status: { premiumStatus: () => ({ active: true, until: '2026-12-01T00:00:00.000Z' }), audience: () => 'tester' },
    store: { subject: () => SUBJECT, rows },
    notify: { locale: () => 'pt-BR', now: () => HOST_NOW, show: () => 'shown', openPremiumTab: () => undefined },
  };
}

interface WorkerHost {
  call(capability: string, args?: unknown): Promise<unknown>;
}

async function wire(options: {
  requested: readonly string[];
  rows?: MemoryRows;
  playingAccountAllows?: () => boolean;
}) {
  const cache = createBundleCache({ root, db: null, now: () => HOST_NOW });
  await cache.write(
    verifiedFixture(
      workerOptions({ sequence: SEQUENCE, flavors: ['dev', 'beta', 'prod'], capabilities: [...options.requested] }),
    ),
  );
  appLeaseGate.set(true, 'holds');
  const fakes = createFakeFork({ loader: true });
  const log = createLogSink();
  const rows = options.rows ?? memoryRows();
  const parts: PremiumHostWiringDeps = {
    flavor: 'dev',
    appVersion: '1.0.0',
    userDataPath: root,
    db: null,
    deviceGet: () => Promise.resolve({ ok: false, reason: 'unreachable' }),
    reloadWindow: () => undefined,
    uiOnAppScheme: true,
    log,
    fork: fakes.fork,
    createChannel: fakes.createChannel,
    loaderPath: 'premium-worker.cjs',
    shims: {},
    vars: {},
    now: () => HOST_NOW,
    mono: () => 0,
    capabilities: capabilities(rows),
    ...(options.playingAccountAllows === undefined ? {} : { playingAccountAllows: options.playingAccountAllows }),
  };
  const host = createPremiumHost(parts);
  hosts.push(host);
  await host.start(SUBJECT);
  await flush({ runner: host });
  const worker = (globalThis as unknown as { __bfcTestHost?: WorkerHost }).__bfcTestHost;
  return { host, fakes, log, rows, worker };
}

function granted(fakes: ReturnType<typeof createFakeFork>): unknown {
  return (fakes.forks[0]?.child.posted[0]?.message as { granted?: unknown } | undefined)?.granted;
}

describe('the capabilities the host grants', () => {
  it('gives a bundle that requests the four all four, and each works', async () => {
    const { fakes, worker, rows } = await wire({ requested: [...PREMIUM_CAPABILITIES] });

    expect(granted(fakes)).toEqual([...PREMIUM_CAPABILITIES]);
    await expect(worker?.call('premium.status')).resolves.toEqual({
      active: true,
      until: '2026-12-01T00:00:00.000Z',
      paused: false,
      pausedReason: null,
      audience: 'tester',
    });
    await worker?.call('store', { op: 'set', key: 'seen', value: 3 });
    await expect(worker?.call('store', { op: 'get', key: 'seen' })).resolves.toBe(3);
    expect([...rows.held.keys()]).toEqual([`premium_store_v1:${SUBJECT}`]);
    await expect(worker?.call('log', { event: 'check.ran', fields: { n: 1 } })).resolves.toBeNull();
    await expect(worker?.call('notify', { id: 'premium.test' })).resolves.toBeNull();
  });

  it('writes the log record with the running bundle sequence', async () => {
    const { worker, log } = await wire({ requested: ['log'] });

    await worker?.call('log', { event: 'check.ran', fields: { n: 1 } });

    expect(log.records.find((record) => record['event'] === 'premium.bundle_log')).toEqual({
      scope: 'premium',
      event: 'premium.bundle_log',
      bundleEvent: 'check.ran',
      sequence: SEQUENCE,
      n: 1,
    });
  });

  it('gives a bundle that also names something unknown only the capabilities the host offers', async () => {
    const { fakes, worker } = await wire({ requested: ['raw.unknown', 'store', 'notify'] });

    expect(granted(fakes)).toEqual(['store', 'notify']);
    await expect(worker?.call('raw.unknown')).rejects.toThrow('not_granted');
    await expect(worker?.call('log', { event: 'x' })).rejects.toThrow('not_granted');
  });

  it('names the four in the audit and any other name as unknown', async () => {
    const { worker, log } = await wire({ requested: [...PREMIUM_CAPABILITIES] });

    await worker?.call('premium.status');
    await worker?.call('store', { op: 'keys' });
    await worker?.call('log', { event: 'x' });
    await worker?.call('notify', { id: 'premium.test' });
    await expect(worker?.call('raw.unknown')).rejects.toThrow('not_granted');

    const audited = log.records
      .filter((record) => record['event'] === 'premium.capability')
      .map((record) => `${String(record['capability'])}:${String(record['outcome'])}`);
    expect(audited).toEqual([
      'premium.status:ok',
      'store:ok',
      'log:ok',
      'notify:ok',
      'unknown:not_granted',
    ]);
  });

  it('refuses a store write that is too large with the reason, and writes nothing', async () => {
    const { worker, rows } = await wire({ requested: ['store'] });

    await expect(worker?.call('store', { op: 'set', key: 'big', value: 'x'.repeat(70_000) })).rejects.toThrow(
      'too_large',
    );
    expect(rows.held.size).toBe(0);
  });

  it('offers nothing when the app gives the host no capabilities', async () => {
    const cache = createBundleCache({ root, db: null, now: () => HOST_NOW });
    await cache.write(verifiedFixture(workerOptions({ flavors: ['dev'], capabilities: ['store'] })));
    appLeaseGate.set(true, 'holds');
    const fakes = createFakeFork({ loader: true });
    const host = createPremiumHost({
      flavor: 'dev',
      appVersion: '1.0.0',
      userDataPath: root,
      db: null,
      deviceGet: () => Promise.resolve({ ok: false, reason: 'unreachable' }),
      reloadWindow: () => undefined,
      uiOnAppScheme: true,
      log: createLogSink(),
      fork: fakes.fork,
      createChannel: fakes.createChannel,
      loaderPath: 'premium-worker.cjs',
      shims: {},
      vars: {},
      now: () => HOST_NOW,
      mono: () => 0,
    });
    hosts.push(host);
    await host.start(SUBJECT);
    await flush({ runner: host });

    expect(granted(fakes)).toEqual([]);
  });
});

describe('the reason the real gate gives', () => {
  it('is other_account when the licence holds and another account is playing', async () => {
    const { host, fakes } = await wire({ requested: ['store'], playingAccountAllows: () => false });
    expect(host.view().phase).toBe('running');
    const sentBefore = fakes.channels[0]?.port1.sent.length ?? 0;

    appLeaseGate.set(false, 'holds');

    expect(host.view().paused).toEqual({ reason: 'other_account' });
    expect(fakes.channels[0]?.port1.sent.slice(sentBefore)).toEqual([{ t: 'paused', reason: 'other_account' }]);

    appLeaseGate.set(true, 'holds');
    expect(host.view()).not.toHaveProperty('paused');
    expect(fakes.channels[0]?.port1.sent.at(-1)).toEqual({ t: 'resumed' });
  });

  it('is unconfirmed when the lease lapsed, whoever is playing', async () => {
    const { host, fakes } = await wire({ requested: ['store'], playingAccountAllows: () => false });
    const sentBefore = fakes.channels[0]?.port1.sent.length ?? 0;

    appLeaseGate.set(false, 'unconfirmed');

    expect(host.view().paused).toEqual({ reason: 'unconfirmed' });
    expect(fakes.channels[0]?.port1.sent.slice(sentBefore)).toEqual([{ t: 'paused', reason: 'unconfirmed' }]);
  });

  it('is unconfirmed when the licence holds and the playing account is the right one', async () => {
    const { host } = await wire({ requested: ['store'], playingAccountAllows: () => true });

    appLeaseGate.set(false, 'holds');

    expect(host.view().paused).toEqual({ reason: 'unconfirmed' });
  });

  it('gives no reason when the app cannot say whose account is playing', async () => {
    const { host, fakes } = await wire({ requested: ['store'] });
    const sentBefore = fakes.channels[0]?.port1.sent.length ?? 0;

    appLeaseGate.set(false, 'holds');

    expect(host.view()).not.toHaveProperty('paused');
    expect(fakes.channels[0]?.port1.sent.slice(sentBefore)).toEqual([{ t: 'paused' }]);
  });
});

describe('removal through the wiring', () => {
  it('deletes the signed-in user store row with the Premium code', async () => {
    const { host, rows, worker } = await wire({ requested: ['store'] });
    await worker?.call('store', { op: 'set', key: 'k', value: 1 });
    expect(rows.held.size).toBe(1);

    host.requestPremiumRemoval('ended');
    await flush({ runner: host });

    expect(rows.held.size).toBe(0);
  });
});
