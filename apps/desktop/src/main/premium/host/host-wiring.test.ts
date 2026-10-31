import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppFlavor } from '@bombfarm/contracts';
import { appLeaseGate } from '../licence/lease-gate';
import { createLogSink } from '../premium-test-support';
import { createBundleCache } from './bundle-cache';
import { DEV_APP_VERSION_ENV, DEV_BUNDLE_DIR_ENV } from './dev-trust';
import { createFakeFork } from './host-fakes';
import { HOST_NOW, signedInput, verifiedFixture } from './host-test-support';
import { createPremiumHost, followSession, mainAssetPath, type PremiumHostWiringDeps } from './host-wiring';
import type { HostRunner } from './host-runner';

// The dev-only reader is reached by `require` in the built app, which plain Node cannot do for this
// source; the test reads the folder with the same function through the test bundler instead.
vi.mock('./dev-loader', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dev-loader')>();
  const { readLocalBundle } = await import('./dev-bundle.js');
  return { ...actual, loadLocalBundle: readLocalBundle };
});

let root = '';
let hosts: HostRunner[] = [];

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'bfc-host-wiring-'));
  hosts = [];
  appLeaseGate.set(false, 'signed_out');
});

afterEach(async () => {
  for (const host of hosts) {
    host.stop();
    await host.idle();
  }
  appLeaseGate.set(false, 'signed_out');
  await rm(root, { recursive: true, force: true });
});

function wire(flavor: AppFlavor, vars: Record<string, string | undefined> = {}, appVersion = '1.0.0') {
  const fakes = createFakeFork({ loader: true });
  const parts: PremiumHostWiringDeps = {
    flavor,
    appVersion,
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
    vars,
    now: () => HOST_NOW,
    mono: () => 0,
  };
  const host = createPremiumHost(parts);
  hosts.push(host);
  return { host, fakes };
}

/** A signed fixture that fits every flavour, put where the cache holds it between runs. */
async function cacheFixture(): Promise<void> {
  const cache = createBundleCache({ root, db: null, now: () => HOST_NOW });
  await cache.write(verifiedFixture({ flavors: ['dev', 'beta', 'prod'] }));
}

async function writeLocalBundle(dir: string): Promise<void> {
  const signed = signedInput({
    edit: (draft) => {
      draft.manifest['sequence'] = 0;
      draft.manifest['keyId'] = null;
      draft.manifest['flavors'] = ['dev'];
    },
  });
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'manifest.json'), signed.manifestBytes);
  for (const [path, bytes] of signed.files) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), bytes);
  }
}

describe('the keys the host trusts', () => {
  it('accepts a bundle signed with the test key in a dev build, and refuses it as beta or prod', async () => {
    await cacheFixture();
    appLeaseGate.set(true, 'holds');

    const dev = wire('dev');
    await dev.host.start('subject-one');
    await dev.host.idle();
    expect(dev.host.view().phase).toBe('running');
    expect(dev.fakes.forks).toHaveLength(1);
    dev.host.stop();
    await dev.host.idle();

    for (const flavor of ['beta', 'prod'] as const) {
      const other = wire(flavor);
      await other.host.start('subject-one');
      await other.host.idle();
      expect({ flavor, running: other.host.view().phase === 'running' }).toEqual({ flavor, running: false });
      expect(other.fakes.forks).toHaveLength(0);
      other.host.stop();
    }
  });
});

describe('the version a bundle must fit', () => {
  const OLD_APP = '0.32.1';

  it('is the version the dev override names, in a dev build only', async () => {
    await cacheFixture();
    appLeaseGate.set(true, 'holds');

    // A bundle that does not fit at start is discarded, so each run below gets a fresh copy.
    const overridden = wire('dev', { [DEV_APP_VERSION_ENV]: '0.32.2' }, OLD_APP);
    await overridden.host.start('subject-one');
    await overridden.host.idle();
    expect(overridden.host.view().phase).toBe('running');
    overridden.host.stop();
    await overridden.host.idle();

    const plain = wire('dev', {}, OLD_APP);
    await plain.host.start('subject-one');
    await plain.host.idle();
    expect(plain.host.view().phase).not.toBe('running');
    plain.host.stop();
    await plain.host.idle();
    await cacheFixture();

    for (const flavor of ['beta', 'prod'] as const) {
      const other = wire(flavor, { [DEV_APP_VERSION_ENV]: '0.32.2' }, OLD_APP);
      await other.host.start('subject-one');
      await other.host.idle();
      expect({ flavor, running: other.host.view().phase === 'running' }).toEqual({ flavor, running: false });
      other.host.stop();
    }
  });
});

describe('the local bundle folder', () => {
  it('is loaded in a dev build that names one, and only then', async () => {
    const folder = join(root, 'local-build');
    await writeLocalBundle(folder);
    appLeaseGate.set(true, 'holds');

    const named = wire('dev', { [DEV_BUNDLE_DIR_ENV]: folder });
    await named.host.start('subject-one');
    expect(named.host.view()).toMatchObject({ phase: 'running', localBuild: true });
    named.host.stop();

    const unnamed = wire('dev');
    await unnamed.host.start('subject-one');
    expect(unnamed.host.view()).toMatchObject({ uiUrl: null, localBuild: false });
    unnamed.host.stop();

    const beta = wire('beta', { [DEV_BUNDLE_DIR_ENV]: folder });
    await beta.host.start('subject-one');
    expect(beta.host.view()).toMatchObject({ uiUrl: null, localBuild: false });
  });
});

describe('the lease gate', () => {
  it('runs the worker only while the app gate is open, and idles in the same tick it closes', async () => {
    await cacheFixture();
    const { host, fakes } = wire('dev');

    await host.start('subject-one');
    await host.idle();
    expect(host.view().phase).toBe('paused');
    expect(fakes.forks).toHaveLength(0);

    appLeaseGate.set(true, 'holds');
    expect(host.view().phase).toBe('running');
    expect(fakes.forks).toHaveLength(1);

    appLeaseGate.set(false, 'unconfirmed');
    expect(host.view().phase).toBe('paused');
  });
});

describe('where a built file is read from', () => {
  const none = () => false;
  const all = () => true;

  it('is beside the main bundle in a folder tree', () => {
    expect(mainAssetPath(join('C:', 'app', 'dist', 'main'), 'premium-worker.cjs', all)).toBe(
      join('C:', 'app', 'dist', 'main', 'premium-worker.cjs'),
    );
  });

  it('is inside the archive when packaging left no unpacked copy', () => {
    const dir = join('C:', 'Program Files', 'App', 'resources', 'app.asar', 'dist', 'main');
    expect(mainAssetPath(dir, 'premium-worker.cjs', none)).toBe(join(dir, 'premium-worker.cjs'));
  });

  it('is the unpacked copy when there is one', () => {
    const dir = join('C:', 'Program Files', 'App', 'resources', 'app.asar', 'dist', 'main');
    const unpacked = join('C:', 'Program Files', 'App', 'resources', 'app.asar.unpacked', 'dist', 'main', 'premium-worker.cjs');
    expect(mainAssetPath(dir, 'premium-worker.cjs', (path) => path === unpacked)).toBe(unpacked);
  });
});

describe('following who is signed in', () => {
  function fakeRunner() {
    const calls: string[] = [];
    const runner = {
      start: (subject: string | null) => {
        calls.push(`start:${String(subject)}`);
        return Promise.resolve();
      },
      signedOut: () => {
        calls.push('signedOut');
      },
    } as unknown as HostRunner;
    return { runner, calls };
  }

  function source(subject: string | null) {
    let listener: ((next: string | null) => void) | null = null;
    return {
      subject: () => subject,
      onSession: (next: (subject: string | null) => void) => {
        listener = next;
        return () => {
          listener = null;
        };
      },
      change: (next: string | null) => listener?.(next),
      listening: () => listener !== null,
    };
  }

  it('starts for the account signed in now, then for each account after it, and stops at sign-out', () => {
    const { runner, calls } = fakeRunner();
    const session = source('subject-one');
    followSession(session, runner, createLogSink());

    session.change('subject-two');
    session.change(null);
    session.change('subject-one');

    expect(calls).toEqual(['start:subject-one', 'start:subject-two', 'signedOut', 'start:subject-one']);
  });

  it('starts for nobody when nobody is signed in, so a pending removal is still swept', () => {
    const { runner, calls } = fakeRunner();
    followSession(source(null), runner, createLogSink());
    expect(calls).toEqual(['start:null']);
  });

  it('stops listening when told to', () => {
    const { runner } = fakeRunner();
    const session = source(null);
    const stop = followSession(session, runner, createLogSink());
    stop();
    expect(session.listening()).toBe(false);
  });

  it('logs a start that fails and goes on', async () => {
    const log = createLogSink();
    const runner = { start: () => Promise.reject(new Error('disk')), signedOut: () => undefined } as unknown as HostRunner;
    followSession(source('subject-one'), runner, log);
    await Promise.resolve();
    await Promise.resolve();
    expect(JSON.stringify(log.records)).toContain('premium.host_start_failed');
  });
});
