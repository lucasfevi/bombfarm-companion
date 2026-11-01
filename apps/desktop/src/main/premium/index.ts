import { existsSync, readFileSync } from 'node:fs';
import { MessageChannelMain, safeStorage, shell, utilityProcess } from 'electron';
import { isAppFlavor, type AppFlavor, type AppLocale, type CapabilityCall, type CapabilityReply, type PremiumActionResult, type PremiumView } from '@bombfarm/contracts';
import type { LogPort, SqliteDb } from '../storage/index.js';
import { createLicenceService, type LicenceService } from './licence/licence-runner.js';
import { createLicenceStore, createSealedRows } from './licence/licence-store.js';
import { createSystemMachineIdentity } from './licence/machine-id.js';
import { createDefaultRemovalPort } from './licence/removal-port.js';
import {
  SHIMS_FILE,
  WORKER_LOADER_FILE,
  createPremiumHost,
  followSession,
  mainAssetPath,
  type PremiumHostWiringDeps,
} from './host/host-wiring.js';
import type { HostRunner } from './host/host-runner.js';
import type { PremiumRoutes } from './host/premium-routes.js';
import type { ForkWorker, PortPair } from './host/worker-supervisor.js';
import { startLoopbackListener } from './loopback-listener.js';
import { createPremiumNotifier } from './notifier.js';
import { createPkce, createState } from './pkce.js';
import { appPlayingAccount } from './playing-account-gate.js';
import { createPremiumApi } from './premium-api.js';
import { createPremiumCache } from './premium-cache.js';
import { offlineBytesFetch, offlinePremiumHttp } from './premium-offline.js';
import { createPremiumService, type GameIdentity, type PremiumService } from './premium-service.js';
import { PREMIUM_API_ORIGIN, createBytesFetch, createPremiumHttp, type FetchBytes, type PremiumHttp } from './premium-transport.js';
import { runtimeLeaseKeys } from './runtime-lease-keys.js';
import { createSubjectStore } from './subject-store.js';
import { createTokenVault, type SecretBox } from './token-vault.js';

export type { PremiumService } from './premium-service.js';

export function createSafeStorageBox(): SecretBox {
  return {
    isAvailable: () => safeStorage.isEncryptionAvailable(),
    encrypt: (plain) => safeStorage.encryptString(plain),
    decrypt: (cipher) => safeStorage.decryptString(cipher),
  };
}

function chooseHttp(offline: boolean, originOverride: string | null): PremiumHttp {
  if (originOverride !== null) return createPremiumHttp(originOverride);
  return offline ? offlinePremiumHttp : createPremiumHttp(PREMIUM_API_ORIGIN);
}

function chooseBytes(offline: boolean, originOverride: string | null): FetchBytes {
  if (originOverride !== null) return createBytesFetch(originOverride);
  return offline ? offlineBytesFetch : createBytesFetch(PREMIUM_API_ORIGIN);
}

export interface ElectronPremiumDeps {
  readonly db: SqliteDb | null;
  readonly originOverride: string | null;
  readonly offline: boolean;
  readonly readGameIdentity: () => GameIdentity | null;
  readonly locale: () => AppLocale;
  readonly log: LogPort;
  readonly onChanged: (view: PremiumView) => void;
  /** The running app's version, reported with every renewal. */
  readonly appVersion?: string;
  /** The flavour's name, reported with every renewal. */
  readonly flavor?: string;
  /** Subscribes to the PC waking from sleep; returns what unsubscribes. */
  readonly onResume?: (listener: () => void) => () => void;
  /** What the Premium host needs from the app; without it no host is built. */
  readonly host?: ElectronHostDeps;
  /** Which build this is and what was packaged; a packaged app built for another flavour builds nothing. */
  readonly build?: PremiumBuild;
}

export interface ElectronHostDeps {
  /** The data folder of the app; the bundle cache lives under it. */
  readonly userDataPath: string;
  /** The folder holding the built main process files. */
  readonly mainDir: string;
  /** Reloads the main window, if there is one. */
  readonly reloadWindow: () => void;
  /** Whether the window is on the `app://` scheme rather than the renderer's dev server. */
  readonly uiOnAppScheme: boolean;
  /** Brings the main window forward on the Premium tab; a click on a Premium notification calls it. */
  readonly openPremiumTab?: () => void;
  /** Builds the host from its parts; the real one unless a test says otherwise. */
  readonly create?: (parts: PremiumHostWiringDeps) => HostRunner;
}

export interface PremiumBuild {
  readonly isPackaged: boolean;
  /** The flavour written into the packaged package file; null when it names none. */
  readonly bakedFlavor: AppFlavor | null;
  /** The flavour this main bundle was compiled for. */
  readonly builtFlavor: AppFlavor;
}

/** A packaged app must be the flavour its code was compiled for. */
export function premiumBuildMismatch(build: PremiumBuild): boolean {
  return build.isPackaged && build.bakedFlavor !== build.builtFlavor;
}

/** The Premium service with the licence service built beside it, started and stopped with it. */
export interface ElectronPremium extends PremiumService {
  /** The player pressed "Use Premium on this PC". */
  useHere(): PremiumActionResult;
  /** The Premium tab could not mount the screen of the bundle. */
  hostMountFailed(): void;
  /** A capability call from the Premium screen; `stopped` unless the host is running. */
  callFromUi(call: CapabilityCall): Promise<CapabilityReply>;
  /** What the `app://` handler serves under `_premium`; null when there is no host. */
  readonly routes: PremiumRoutes | null;
}

export function createPremiumWhenEnabled(enabled: boolean, deps: ElectronPremiumDeps): ElectronPremium | null {
  if (!enabled) return null;
  if (deps.build !== undefined && premiumBuildMismatch(deps.build)) {
    deps.log.error({ scope: 'premium', event: 'premium.build_mismatch' });
    return null;
  }
  return createElectronPremium(deps);
}

function readShims(mainDir: string): Record<string, readonly string[]> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(mainAssetPath(mainDir, SHIMS_FILE, existsSync), 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, readonly string[]>) : null;
  } catch {
    return null;
  }
}

const forkWorker: ForkWorker = (modulePath, args, options) =>
  utilityProcess.fork(modulePath, args, {
    serviceName: options.serviceName,
    stdio: options.stdio,
    env: { ...options.env },
    execArgv: [...options.execArgv],
  });

const createPortPair = (): PortPair => new MessageChannelMain();

export function createElectronPremium(deps: ElectronPremiumDeps): ElectronPremium {
  const box = createSafeStorageBox();
  const api = createPremiumApi(chooseHttp(deps.offline, deps.originOverride));
  let licence: LicenceService | null = null;
  let host: HostRunner | null = null;
  const premium = createPremiumService({
    api,
    vault: createTokenVault(deps.db, box),
    subjectStore: createSubjectStore(deps.db, box),
    cache: createPremiumCache(deps.db),
    openExternal: (url) => shell.openExternal(url),
    readGameIdentity: deps.readGameIdentity,
    startListener: startLoopbackListener,
    locale: deps.locale,
    pkce: { createPkce, createState },
    now: () => Date.now(),
    log: deps.log,
    onChanged: deps.onChanged,
    playingAccount: appPlayingAccount,
    licenceView: () => licence?.view() ?? null,
    hostView: () => host?.view() ?? null,
  });
  host = buildHost(
    deps,
    (req) => {
      if (licence === null) throw new Error('premium_licence_missing');
      return licence.deviceGet(req);
    },
    premium,
    box,
  );
  const service = createLicenceService({
    host: premium.host,
    api,
    store: createLicenceStore(deps.db, box),
    secureStorage: () => box.isAvailable(),
    identity: createSystemMachineIdentity(),
    removal: host ?? createDefaultRemovalPort(),
    bytes: chooseBytes(deps.offline, deps.originOverride),
    keys: runtimeLeaseKeys(deps.flavor, process.env),
    account: { allows: () => appPlayingAccount.allows(), subscribe: (listener) => appPlayingAccount.subscribe(() => { listener(); }) },
    now: () => Date.now(),
    mono: () => performance.now(),
    log: deps.log,
    appVersion: deps.appVersion ?? '0.0.0',
    flavor: deps.flavor ?? 'dev',
    enabled: true,
    onChanged: () => {
      premium.noteLicenceChanged();
    },
  });
  licence = service;
  let stopResume: (() => void) | null = null;
  let stopHostWatch: (() => void) | null = null;

  function startHost(runner: HostRunner): void {
    const stopSession = followSession(premium.host, runner, deps.log);
    const stopView = runner.subscribe(() => {
      premium.noteLicenceChanged();
    });
    stopHostWatch = () => {
      stopSession();
      stopView();
    };
  }

  return {
    ...premium,
    routes: host?.routes ?? null,
    start() {
      premium.start();
      service.start();
      if (host !== null) startHost(host);
      stopResume ??= deps.onResume?.(() => {
        service.trigger('resume');
      }) ?? null;
    },
    stop() {
      stopResume?.();
      stopResume = null;
      stopHostWatch?.();
      stopHostWatch = null;
      host?.stop();
      service.stop();
      premium.stop();
    },
    async refresh(reason) {
      const result = await premium.refresh(reason);
      // A refused refresh (inside the service's floor) sends no renewal either.
      if (reason === 'button' && result.ok) service.trigger('refresh');
      return result;
    },
    useHere() {
      service.pressMove();
      return { ok: true };
    },
    hostMountFailed() {
      host?.mountFailed();
    },
    callFromUi(call) {
      return host?.callFromUi(call) ?? Promise.resolve({ id: call.id, ok: false, error: 'unavailable' });
    },
  };
}

/** The Premium host, or null when the app gave it nothing to be built from. */
function buildHost(
  deps: ElectronPremiumDeps,
  deviceGet: PremiumHostWiringDeps['deviceGet'],
  premium: PremiumService,
  box: SecretBox,
): HostRunner | null {
  const wiring = deps.host;
  if (wiring === undefined) return null;
  const shims = readShims(wiring.mainDir);
  if (shims === null) {
    deps.log.error({ scope: 'premium', event: 'premium.host_unavailable', reason: 'shims_unreadable' });
    return null;
  }
  const parts: PremiumHostWiringDeps = {
    flavor: isAppFlavor(deps.flavor) ? deps.flavor : 'prod',
    appVersion: deps.appVersion ?? '0.0.0',
    userDataPath: wiring.userDataPath,
    db: deps.db,
    deviceGet,
    reloadWindow: wiring.reloadWindow,
    uiOnAppScheme: wiring.uiOnAppScheme,
    log: deps.log,
    fork: forkWorker,
    createChannel: createPortPair,
    loaderPath: mainAssetPath(wiring.mainDir, WORKER_LOADER_FILE, existsSync),
    shims,
    vars: process.env,
    now: () => Date.now(),
    mono: () => performance.now(),
    capabilities: {
      status: { premiumStatus: () => premium.statusSnapshot(), audience: () => premium.audience() },
      store: { subject: () => premium.host.subject(), rows: createSealedRows(deps.db, box) },
      notify: {
        locale: deps.locale,
        now: () => Date.now(),
        // Built when a toast is shown, so nothing of Electron's is touched while wiring.
        show: (toast) => createPremiumNotifier()(toast),
        openPremiumTab: () => {
          wiring.openPremiumTab?.();
        },
      },
    },
    playingAccountAllows: () => appPlayingAccount.allows(),
  };
  return (wiring.create ?? createPremiumHost)(parts);
}
