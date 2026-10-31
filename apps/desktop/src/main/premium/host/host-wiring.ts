import { join } from 'node:path';
import { BUNDLE_PUBLIC_KEYS, PLUGIN_API_VERSION, type AppFlavor } from '@bombfarm/contracts';
import type { LogPort, SqliteDb } from '../../storage/index.js';
import type { DeviceGetRequest, DeviceGetResult } from '../licence/licence-runner.js';
import { onPremiumLeaseChange, premiumLeaseAllows } from '../licence/lease-gate.js';
import { createBundleCache } from './bundle-cache.js';
import { createBundleKeyTable } from './bundle-verify.js';
import { loadDevTrust, loadLocalBundle } from './dev-loader.js';
import { createHostRunner, type HostGate, type HostRunner } from './host-runner.js';
import { createWorkerSupervisor, type ForkWorker, type PortPair } from './worker-supervisor.js';

/**
 * Builds the Premium host from the app's parts. This is the one place the lease gate is read for the
 * host, and the one place that decides what the host trusts: the shipped bundle keys, plus the test
 * key and the local bundle folder in a dev build (through the dev-only loader and nowhere else).
 */

/** The built files the main process reads beside its own bundle. */
export const WORKER_LOADER_FILE = 'premium-worker.cjs';
export const SHIMS_FILE = 'premium-shims.json';

const ASAR = /([\\/])app\.asar(?=[\\/])/;

/**
 * The path of a file the build put beside the main bundle. A process forked from Electron reads
 * `app.asar` like a folder, so the file is used where it is; a copy next to the archive wins when
 * the packaging unpacked one.
 */
export function mainAssetPath(mainDir: string, file: string, exists: (path: string) => boolean): string {
  const inPlace = join(mainDir, file);
  if (!ASAR.test(inPlace)) return inPlace;
  const unpacked = inPlace.replace(ASAR, '$1app.asar.unpacked');
  return exists(unpacked) ? unpacked : inPlace;
}

export interface PremiumHostWiringDeps {
  /** The flavour the app is running as. */
  readonly flavor: AppFlavor;
  readonly appVersion: string;
  /** The app's data folder; the bundle cache lives under it. */
  readonly userDataPath: string;
  readonly db: SqliteDb | null;
  /** The licence service's signed GET. */
  readonly deviceGet: (req: DeviceGetRequest) => Promise<DeviceGetResult>;
  readonly reloadWindow: () => void;
  /** Whether the window is on the `app://` scheme rather than the renderer's dev server. */
  readonly uiOnAppScheme: boolean;
  readonly log: LogPort;
  /** Starts a utility process; Electron's `utilityProcess.fork` fits. */
  readonly fork: ForkWorker;
  /** A fresh pair of message ports; Electron's `MessageChannelMain` fits. */
  readonly createChannel: () => PortPair;
  /** The built worker loader's path. */
  readonly loaderPath: string;
  /** The export names of the shared modules, from the build. */
  readonly shims: Readonly<Record<string, readonly string[]>>;
  /** The process environment. */
  readonly vars: Readonly<Record<string, string | undefined>>;
  readonly now: () => number;
  readonly mono: () => number;
}

/** The host's view of the app's lease gate. */
function leaseGate(): HostGate {
  return {
    allows: () => premiumLeaseAllows(),
    subscribe: (listener) =>
      onPremiumLeaseChange((allows) => {
        listener(allows);
      }),
  };
}

export function createPremiumHost(deps: PremiumHostWiringDeps): HostRunner {
  const trust = loadDevTrust({ flavor: deps.flavor, vars: deps.vars });
  const keys = createBundleKeyTable([...BUNDLE_PUBLIC_KEYS, ...(trust?.bundleKeys ?? [])]);
  const devBundleDir = trust?.devBundleDir ?? null;
  // A dev build may judge bundle fit against another version (see `DEV_APP_VERSION_ENV`).
  const fitVersion = trust?.appVersion ?? deps.appVersion;

  return createHostRunner({
    enabled: true,
    flavor: deps.flavor,
    appVersion: fitVersion,
    gate: leaseGate(),
    cache: createBundleCache({ root: deps.userDataPath, db: deps.db, now: deps.now }),
    deviceGet: deps.deviceGet,
    supervisor: createWorkerSupervisor({
      fork: deps.fork,
      createChannel: deps.createChannel,
      loaderPath: deps.loaderPath,
      vars: deps.vars,
      allowlist: new Map(),
      now: deps.now,
      log: deps.log,
    }),
    keys,
    shims: deps.shims,
    ...(devBundleDir === null
      ? {}
      : {
          localBundle: () =>
            loadLocalBundle(devBundleDir, { hostApi: PLUGIN_API_VERSION, appVersion: fitVersion, flavor: deps.flavor }),
        }),
    reloadWindow: deps.reloadWindow,
    uiOnAppScheme: deps.uiOnAppScheme,
    now: deps.now,
    mono: deps.mono,
    log: deps.log,
  });
}

/** Who is signed in, and when that changes (the Premium service's side of the licence port). */
export interface HostSessionSource {
  subject(): string | null;
  onSession(listener: (subject: string | null) => void): () => void;
}

/**
 * Starts the host for the account signed in now, and again for each account after it; signing out
 * stops the worker and unmounts the UI, and leaves the downloaded folder where it is.
 */
export function followSession(source: HostSessionSource, runner: HostRunner, log: LogPort): () => void {
  const run = (subject: string | null): void => {
    runner.start(subject).catch((error: unknown) => {
      log.error({ scope: 'premium', event: 'premium.host_start_failed', error: String(error) });
    });
  };
  const stop = source.onSession((subject) => {
    if (subject === null) runner.signedOut();
    else run(subject);
  });
  run(source.subject());
  return stop;
}
