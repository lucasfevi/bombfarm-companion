import { createHash } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FixtureOptions } from '../../../../tests/fixtures/premium/sign-fixture.mjs';
import { createFakeClock, createLogSink, type FakeClock, type LogSink } from '../premium-test-support.js';
import type { DeviceGetRequest, DeviceGetResult } from '../licence/licence-runner.js';
import {
  createBundleCache,
  nodeCacheFs,
  type BundleCache,
  type CacheFs,
} from './bundle-cache.js';
import { createFakeFork, type FakeFork } from './host-fakes.js';
import { createMetaDb, signedInput, TEST_KEYS } from './host-test-support.js';
import { createHostRunner, type HostGate, type HostRunner, type HostRunnerDeps } from './host-runner.js';
import { createWorkerSupervisor, type WorkerSupervisor } from './worker-supervisor.js';
import type { BundleInput } from './bundle-verify.js';

/** A whole host over fakes: a gate, a server, a worker process, a temp cache and a fake clock. */

export const SUBJECT = 'user-subject-marker-0001';
export const OTHER_SUBJECT = 'user-subject-marker-0002';

const enc = (value: unknown): Uint8Array => new Uint8Array(Buffer.from(JSON.stringify(value), 'utf8'));

export interface FakeGate extends HostGate {
  set(allows: boolean): void;
}

export function createFakeGate(initial = false): FakeGate {
  let open = initial;
  const listeners = new Set<(allows: boolean) => void>();
  return {
    allows: () => open,
    set(allows) {
      if (allows === open) return;
      open = allows;
      for (const listener of [...listeners]) listener(allows);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The bundle server: answers the manifest route with the current bundle and each file from it. */
export interface BundleServer {
  /** Makes this the bundle the manifest route offers. */
  publish(options?: FixtureOptions): BundleInput;
  /** Every request that reached the server, in order. */
  requests: DeviceGetRequest[];
  /** Every call to the stub, including the ones a closed gate refused. */
  attempts: number;
  /** Answers a file request with this instead, once per match. */
  failFile: ((path: string) => DeviceGetResult | undefined) | null;
  /** The manifest route answers this instead (a 404 with a reason, for instance). */
  manifestReply: DeviceGetResult | null;
  deviceGet: (req: DeviceGetRequest) => Promise<DeviceGetResult>;
}

export function createBundleServer(gate: HostGate): BundleServer {
  const bundles = new Map<number, BundleInput>();
  let current: BundleInput | null = null;
  const server: BundleServer = {
    requests: [],
    attempts: 0,
    failFile: null,
    manifestReply: null,
    publish(options = {}) {
      const input = signedInput(options);
      const manifest = JSON.parse(Buffer.from(input.manifestBytes).toString('utf8')) as { sequence: number };
      bundles.set(manifest.sequence, input);
      current = input;
      return input;
    },
    deviceGet: async (req) => {
      server.attempts += 1;
      // The licence service refuses while its gate is closed, and sends nothing.
      if (!gate.allows()) return { ok: false, reason: 'gate_closed' };
      server.requests.push(req);
      await Promise.resolve();
      if (req.route.r === 'bundle') {
        if (server.manifestReply !== null) return server.manifestReply;
        if (current === null) return { ok: true, status: 404, bytes: enc({ reason: 'none' }), retryAfterSec: null };
        const manifest = JSON.parse(Buffer.from(current.manifestBytes).toString('utf8')) as { sequence: number };
        return {
          ok: true,
          status: 200,
          retryAfterSec: null,
          bytes: enc({
            sequence: manifest.sequence,
            manifest: Buffer.from(current.manifestBytes).toString('base64'),
            signature: Buffer.from(current.sig).toString('base64url'),
            files: [],
          }),
        };
      }
      const override = server.failFile?.(req.route.path);
      if (override !== undefined) return override;
      const input = bundles.get(req.route.sequence);
      const bytes = input?.files.get(req.route.path);
      if (bytes === undefined) return { ok: true, status: 404, bytes: new Uint8Array(), retryAfterSec: null };
      return { ok: true, status: 200, bytes, retryAfterSec: null };
    },
  };
  return server;
}

export interface HostRig {
  root: string;
  clock: FakeClock;
  gate: FakeGate;
  server: BundleServer;
  fakes: FakeFork;
  supervisor: WorkerSupervisor;
  cache: BundleCache;
  db: ReturnType<typeof createMetaDb>;
  log: LogSink;
  runner: HostRunner;
  reloads: number;
  goneCalls: number;
  views: string[];
  /** The test worker's `host` object, once the bundle's `start` ran. */
  workerHost(): { call(capability: string, args?: unknown): Promise<unknown> } | undefined;
  dispose(): Promise<void>;
}

export interface RigOptions {
  root?: string;
  db?: ReturnType<typeof createMetaDb>;
  gate?: FakeGate;
  fs?: CacheFs;
  server?: BundleServer;
  localBundle?: HostRunnerDeps['localBundle'];
  removalRetryMs?: readonly number[];
  appVersion?: string;
  enabled?: boolean;
}

/** The one capability the rig's host offers to a worker. */
export const ECHO_CAPABILITY = 'test.echo';

export async function createHostRig(options: RigOptions = {}): Promise<HostRig> {
  const root = options.root ?? (await mkdtemp(join(tmpdir(), 'bfc-host-')));
  const clock = createFakeClock();
  const gate = options.gate ?? createFakeGate();
  const server = options.server ?? createBundleServer(gate);
  const fakes = createFakeFork({ loader: true });
  const log = createLogSink();
  const db = options.db ?? createMetaDb();
  const cache = createBundleCache({ root, db, now: () => clock.now(), ...(options.fs ? { fs: options.fs } : {}) });
  const supervisor = createWorkerSupervisor({
    fork: fakes.fork,
    createChannel: fakes.createChannel,
    loaderPath: 'premium-worker.cjs',
    vars: { SYSTEMROOT: 'C:\\Windows', TEMP: 'C:\\Temp', TMP: 'C:\\Temp' },
    allowlist: new Map([[ECHO_CAPABILITY, () => 'pong']]),
    now: () => clock.mono(),
    log,
  });
  const rig: HostRig = {
    root,
    clock,
    gate,
    server,
    fakes,
    supervisor,
    cache,
    db,
    log,
    reloads: 0,
    goneCalls: 0,
    views: [],
    runner: undefined as unknown as HostRunner,
    workerHost: () => (globalThis as unknown as { __bfcTestHost?: ReturnType<HostRig['workerHost']> }).__bfcTestHost,
    async dispose() {
      rig.runner.stop();
      await rig.runner.idle();
      (globalThis as unknown as { __bfcTestHost?: unknown }).__bfcTestHost = undefined;
      await rm(root, { recursive: true, force: true });
    },
  };
  rig.runner = createHostRunner({
    enabled: options.enabled ?? true,
    flavor: 'dev',
    appVersion: options.appVersion ?? '1.0.0',
    gate,
    cache,
    deviceGet: server.deviceGet,
    supervisor,
    keys: TEST_KEYS,
    shims: {},
    ...(options.localBundle ? { localBundle: options.localBundle } : {}),
    reloadWindow: () => {
      rig.reloads += 1;
    },
    now: () => clock.now(),
    mono: () => clock.mono(),
    scheduler: clock.scheduler,
    log,
    ...(options.removalRetryMs ? { removalRetryMs: options.removalRetryMs } : {}),
  });
  rig.runner.attach(() => {
    rig.goneCalls += 1;
  });
  rig.runner.subscribe(() => {
    rig.views.push(rig.runner.view().phase);
  });
  return rig;
}

/** The fixture worker stand-in: `start` keeps the `host` object on a global the test can read. */
export const TEST_WORKER_CODE = [
  'module.exports.start = (host) => {',
  '  globalThis.__bfcTestHost = host;',
  '};',
  '',
].join('\n');

/** A bundle that declares the capability the rig's host offers, and a worker the test can drive. */
export function workerOptions(extra: FixtureOptions = {}): FixtureOptions {
  return {
    capabilities: [ECHO_CAPABILITY],
    ...extra,
    edit: (draft) => {
      const bytes = new Uint8Array(Buffer.from(TEST_WORKER_CODE, 'utf8'));
      draft.files.set('worker/index.cjs', bytes);
      const listed = draft.manifest['files'] as Array<{ path: string; size: number; sha256: string }>;
      const entry = listed.find((file) => file.path === 'worker/index.cjs');
      if (entry) {
        entry.size = bytes.length;
        entry.sha256 = createHash('sha256').update(bytes).digest('hex');
      }
      extra.edit?.(draft);
    },
  };
}

export async function folders(root: string): Promise<string[]> {
  try {
    return (await readdir(join(root, 'premium'))).sort();
  } catch {
    return [];
  }
}

export async function topLevel(root: string): Promise<string[]> {
  return (await readdir(root)).sort();
}

/** The real file system, with chosen operations refused. */
export function faultyFs(fault: (op: string, path: string) => Error | null): CacheFs {
  const check = async (op: string, path: string): Promise<void> => {
    const failure = fault(op, path);
    if (failure !== null) throw failure;
    await Promise.resolve();
  };
  return {
    readdir: async (path) => {
      await check('readdir', path);
      return nodeCacheFs.readdir(path);
    },
    readFile: async (path) => {
      await check('readFile', path);
      return nodeCacheFs.readFile(path);
    },
    writeFile: async (path, data) => {
      await check('writeFile', path);
      return nodeCacheFs.writeFile(path, data);
    },
    mkdir: async (path) => {
      await check('mkdir', path);
      return nodeCacheFs.mkdir(path);
    },
    rename: async (from, to) => {
      await check('rename', from);
      return nodeCacheFs.rename(from, to);
    },
    rm: async (path) => {
      await check('rm', path);
      return nodeCacheFs.rm(path);
    },
  };
}

/** Lets pending microtasks, port deliveries and the host's queued cache work finish. */
export async function flush(subject?: { runner: HostRunner }): Promise<void> {
  for (let round = 0; round < 3; round += 1) {
    for (let i = 0; i < 6; i += 1) await new Promise<void>((resolve) => setImmediate(resolve));
    await subject?.runner.idle();
  }
}
