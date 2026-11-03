import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PREMIUM_CAPABILITIES } from '@bombfarm/contracts';
import { createPremiumTapFeedSlot } from '../../live-source/premium-tap-feed';
import { appLeaseGate } from '../licence/lease-gate';
import type { KeepingSealedRows } from '../licence/licence-store';
import { createLogSink } from '../premium-test-support';
import type { LockedDb, TrackingEngine } from '../tracking/engine';
import { subjectHash, TRACKING_DIR, trackingKeyRow } from '../tracking/tracking-store';
import { createBundleCache } from './bundle-cache';
import { createFakeFork } from './host-fakes';
import { flush, workerOptions } from './host-service-test-support';
import { HOST_NOW, verifiedFixture } from './host-test-support';
import { createPremiumHost, type PremiumHostWiringDeps } from './host-wiring';
import type { HostRunner } from './host-runner';

const SUBJECT = 'subject-marker-0001';

let root = '';
let hosts: HostRunner[] = [];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'bfc-host-tracking-'));
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

function memoryRows(): KeepingSealedRows & { held: Map<string, string> } {
  const held = new Map<string, string>();
  return {
    held,
    available: () => true,
    read: <T>(key: string, parse: (v: Record<string, unknown>) => T | null) => {
      const raw = held.get(key);
      return raw === undefined ? null : parse(JSON.parse(raw) as Record<string, unknown>);
    },
    readKept: <T>(key: string, parse: (v: Record<string, unknown>) => T | null) => {
      const raw = held.get(key);
      if (raw === undefined) return { ok: false, reason: 'absent' } as const;
      const value = parse(JSON.parse(raw) as Record<string, unknown>);
      return value === null ? ({ ok: false, reason: 'unreadable' } as const) : ({ ok: true, value } as const);
    },
    write: (key, json) => {
      held.set(key, json());
      return 'written';
    },
    delete: (key) => held.delete(key) || true,
  };
}

const engine: TrackingEngine = {
  probe: () => Promise.resolve({ ok: true, version: 'v-test' }),
  open: async (file) => {
    if (!existsSync(file)) await writeFile(file, 'created-by-attach');
    const raw: LockedDb = {
      run: () => Promise.resolve(),
      query: () => Promise.resolve([]),
      session: () => Promise.reject(new Error('the fake engine has no sessions')),
      close: () => undefined,
    };
    return raw;
  },
};

interface WorkerHost {
  call(capability: string, args?: unknown): Promise<unknown>;
}

async function wire(options: { requested: readonly string[]; withTracking?: boolean }) {
  const cache = createBundleCache({ root, db: null, now: () => HOST_NOW });
  await cache.write(
    verifiedFixture(workerOptions({ sequence: 6, flavors: ['dev', 'beta', 'prod'], capabilities: [...options.requested] })),
  );
  appLeaseGate.set(true, 'holds');
  const fakes = createFakeFork({ loader: true });
  const rows = memoryRows();
  const slot = createPremiumTapFeedSlot();
  const parts: PremiumHostWiringDeps = {
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
    capabilities: {
      status: { premiumStatus: () => ({ active: true, until: '2026-12-01T00:00:00.000Z' }), audience: () => 'tester' },
      store: { subject: () => SUBJECT, rows },
      notify: { locale: () => 'en', now: () => HOST_NOW, show: () => 'shown', openPremiumTab: () => undefined },
      ...(options.withTracking === false
        ? {}
        : {
            tracking: {
              rows,
              extensionPath: 'not-used',
              engine,
              feedSlot: slot,
              playingAccountAllows: () => true,
              accountKey: () => '486',
              secrets: () => new Set<string>(),
              battleLog: {
                source: { stat: () => null, read: () => null, gameLanguage: () => null },
              },
            },
          }),
    },
  };
  const host = createPremiumHost(parts);
  hosts.push(host);
  await host.start(SUBJECT);
  await flush({ runner: host });
  const worker = (globalThis as unknown as { __bfcTestHost?: WorkerHost }).__bfcTestHost;
  return { host, fakes, rows, worker };
}

function granted(fakes: ReturnType<typeof createFakeFork>): unknown {
  return (fakes.forks[0]?.child.posted[0]?.message as { granted?: unknown } | undefined)?.granted;
}

describe('the tracking capabilities the host grants', () => {
  it('gives a bundle that requests all eight all eight, and each of the four new ones answers', async () => {
    const { fakes, worker, rows } = await wire({ requested: [...PREMIUM_CAPABILITIES] });

    expect(granted(fakes)).toEqual([...PREMIUM_CAPABILITIES]);
    await expect(worker?.call('db', { op: 'status' })).resolves.toEqual({ state: 'ready' });
    await expect(worker?.call('db', { op: 'size' })).resolves.toEqual({ bytes: expect.any(Number) as number });
    await expect(worker?.call('raw.tap', { op: 'subscribe' })).resolves.toBeNull();
    await expect(worker?.call('raw.tap', { op: 'unsubscribe' })).resolves.toBeNull();
    await expect(worker?.call('raw.battleLog', { op: 'subscribe' })).resolves.toBeNull();
    await expect(worker?.call('raw.battleLog', { op: 'unsubscribe' })).resolves.toBeNull();
    // `premium.worker` is for the Premium screen; the worker itself is refused.
    await expect(worker?.call('premium.worker', { hello: 1 })).rejects.toThrow('not_granted');
    expect(existsSync(join(root, TRACKING_DIR, `${subjectHash(SUBJECT)}.duckdb`))).toBe(true);
    expect(rows.held.has(trackingKeyRow(SUBJECT))).toBe(true);
  });

  it('gives a bundle that also names something unknown only the intersection', async () => {
    const { fakes, worker } = await wire({ requested: ['raw.unknown', 'db', 'raw.battleLog', 'store'] });

    expect(granted(fakes)).toEqual(['db', 'raw.battleLog', 'store']);
    await expect(worker?.call('raw.unknown')).rejects.toThrow('not_granted');
    await expect(worker?.call('raw.tap', { op: 'subscribe' })).rejects.toThrow('not_granted');
  });

  it('shares nothing between a call from the screen and the worker: the screen reads, the worker writes', async () => {
    const { host, worker } = await wire({ requested: ['db', 'premium.worker'] });
    await worker?.call('db', { op: 'status' });

    await expect(host.callFromUi({ id: 1, capability: 'db', args: { op: 'size' } })).resolves.toEqual({
      id: 1,
      ok: true,
      value: { bytes: expect.any(Number) as number },
    });
    await expect(host.callFromUi({ id: 2, capability: 'db', args: { op: 'exec', sql: 'select 1' } })).resolves.toMatchObject({
      ok: false,
      error: 'not_granted',
    });
    await expect(host.callFromUi({ id: 3, capability: 'raw.tap', args: { op: 'subscribe' } })).resolves.toMatchObject({
      ok: false,
      error: 'not_granted',
    });
  });

  it('refuses the four when the app builds the host without the tracking parts', async () => {
    const { worker } = await wire({ requested: [...PREMIUM_CAPABILITIES], withTracking: false });

    for (const name of ['db', 'raw.tap', 'raw.battleLog']) {
      await expect(worker?.call(name, { op: 'status' })).rejects.toThrow('unavailable');
    }
  });

  it('exposes the history and the clear for the signed-in subject whether or not a worker runs', async () => {
    const { host, worker } = await wire({ requested: ['db'] });
    await worker?.call('db', { op: 'status' });

    expect(host.trackingHistory?.(SUBJECT)).toEqual({ state: 'present', bytes: expect.any(Number) as number });
    host.stop();
    await host.idle();
    await expect(host.clearTrackingHistory?.(SUBJECT)).resolves.toBe('cleared');
    expect(host.trackingHistory?.(SUBJECT)).toEqual({ state: 'none' });
  });
});
