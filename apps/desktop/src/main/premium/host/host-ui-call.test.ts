import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appLeaseGate } from '../licence/lease-gate';
import type { Parse, SealedRows } from '../licence/licence-store';
import { createLogSink } from '../premium-test-support';
import { createBundleCache } from './bundle-cache';
import { createFakeFork } from './host-fakes';
import { flush, workerOptions } from './host-service-test-support';
import { HOST_NOW, verifiedFixture } from './host-test-support';
import { createPremiumHost, type PremiumHostWiringDeps } from './host-wiring';
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
  root = await mkdtemp(join(tmpdir(), 'bfc-host-ui-call-'));
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

function rows(): SealedRows {
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
  } as SealedRows;
}

async function wire(granted: boolean) {
  const cache = createBundleCache({ root, db: null, now: () => HOST_NOW });
  await cache.write(
    verifiedFixture(
      workerOptions({ sequence: SEQUENCE, flavors: ['dev', 'beta', 'prod'], capabilities: granted ? ['premium.status', 'store'] : [] }),
    ),
  );
  appLeaseGate.set(true, 'holds');
  const fakes = createFakeFork({ loader: true });
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
      status: { premiumStatus: () => ({ active: true, until: '2026-12-01T00:00:00.000Z' }), audience: () => 'public' },
      store: { subject: () => SUBJECT, rows: rows() },
      notify: { locale: () => 'en', now: () => HOST_NOW, show: () => 'shown', openPremiumTab: () => undefined },
    },
  };
  const host = createPremiumHost(parts);
  hosts.push(host);
  return { host, fakes };
}

describe('a capability call from the Premium screen', () => {
  it('is answered stopped before the host runs a bundle', async () => {
    const { host } = await wire(true);
    await expect(host.callFromUi({ id: 0, capability: 'premium.status', args: null })).resolves.toEqual({
      id: 0,
      ok: false,
      error: 'stopped',
    });
  });

  it('reaches the capability while the host is running', async () => {
    const { host } = await wire(true);
    await host.start(SUBJECT);
    await flush({ runner: host });

    const reply = await host.callFromUi({ id: 0, capability: 'premium.status', args: null });
    expect(reply).toMatchObject({ ok: true, value: { active: true, paused: false } });
    await expect(host.callFromUi({ id: 0, capability: 'store', args: { op: 'set', key: 'k', value: 1 } })).resolves.toMatchObject({
      ok: true,
    });
  });

  it('is refused by the same grant as the bundle: a capability the bundle did not request', async () => {
    const { host } = await wire(false);
    await host.start(SUBJECT);
    await flush({ runner: host });

    await expect(host.callFromUi({ id: 0, capability: 'store', args: { op: 'keys' } })).resolves.toEqual({
      id: 0,
      ok: false,
      error: 'not_granted',
    });
  });

  it('is refused paused while the licence is not confirmed, like the bundle', async () => {
    const { host } = await wire(true);
    await host.start(SUBJECT);
    await flush({ runner: host });
    appLeaseGate.set(false, 'unconfirmed');
    await flush({ runner: host });

    await expect(host.callFromUi({ id: 0, capability: 'premium.status', args: null })).resolves.toEqual({
      id: 0,
      ok: false,
      error: 'paused',
    });
  });

  it('is answered stopped after the host stops', async () => {
    const { host } = await wire(true);
    await host.start(SUBJECT);
    await flush({ runner: host });
    host.stop();

    await expect(host.callFromUi({ id: 0, capability: 'premium.status', args: null })).resolves.toMatchObject({
      ok: false,
      error: 'stopped',
    });
  });
});
