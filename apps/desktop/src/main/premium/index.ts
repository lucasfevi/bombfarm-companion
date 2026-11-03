import { existsSync, readFileSync } from 'node:fs';
import { MessageChannelMain, safeStorage, shell, utilityProcess } from 'electron';
import { isAppFlavor, type AppFlavor, type AppLocale, type CapabilityCall, type CapabilityReply, type PremiumActionResult, type PremiumView, type TrackingHistoryView } from '@bombfarm/contracts';
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
import { cachedSecrets } from './host/tracking-host.js';
import type { ForkWorker, PortPair } from './host/worker-supervisor.js';
import type { BattleLogSource } from './tracking/battle-log-tailer.js';
import type { ClearOutcome } from './tracking/tracking-store.js';
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
import { createTokenVault, type SecretBox, type TokenVault } from './token-vault.js';

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
  /** What the tracking capabilities need from the game's side; without it they refuse every call. */
  readonly tracking?: ElectronTrackingDeps;
}

/** The game facts the tracking capabilities need, composed by the app (this folder never reads a game file). */
export interface ElectronTrackingDeps {
  /** Where the signed DuckDB extension is shipped. */
  readonly extensionPath: string;
  /** The game's own credentials, as the plain values a worker must never receive. */
  readonly gameSecrets: () => readonly string[];
  /** The battle log and the game settings, read only for a player who granted consent. */
  readonly battleLog: {
    readonly source: BattleLogSource;
    readonly watch?: (wake: () => void) => () => void;
  };
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
  /** A bundle section could not mount in the window; log only. */
  sectionMountFailed(): void;
  /** A capability call from the Premium screen; `stopped` unless the host is running. */
  callFromUi(call: CapabilityCall): Promise<CapabilityReply>;
  /** What the `app://` handler serves under `_premium`; null when there is no host. */
  readonly routes: PremiumRoutes | null;
  /**
   * The signed-in user's tracking history on disk, for Settings; works with Premium inactive. Null
   * when nobody is signed in or the host has no tracking.
   */
  trackingHistory(): TrackingHistoryView | null;
  /**
   * Deletes the signed-in user's tracking file and key; works with Premium inactive. Null (nothing
   * deleted) when nobody is signed in or the host has no tracking.
   */
  clearTrackingHistory(): Promise<ClearOutcome | null>;
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
  const vault = createTokenVault(deps.db, box);
  let licence: LicenceService | null = null;
  let host: HostRunner | null = null;
  const premium = createPremiumService({
    api,
    vault,
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
    vault,
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
      // The one engine probe runs a few seconds from now, off the start-up path.
      host?.armTrackingProbe?.();
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
    sectionMountFailed() {
      deps.log.warn({ scope: 'premium', event: 'premium.section_mount', outcome: 'failed' });
    },
    callFromUi(call) {
      return host?.callFromUi(call) ?? Promise.resolve({ id: call.id, ok: false, error: 'unavailable' });
    },
    trackingHistory() {
      const who = premium.host.subject();
      return who === null ? null : (host?.trackingHistory?.(who) ?? null);
    },
    clearTrackingHistory() {
      const who = premium.host.subject();
      if (who === null || host?.clearTrackingHistory === undefined) return Promise.resolve(null);
      return host.clearTrackingHistory(who);
    },
  };
}

/** The Premium host, or null when the app gave it nothing to be built from. */
function buildHost(
  deps: ElectronPremiumDeps,
  deviceGet: PremiumHostWiringDeps['deviceGet'],
  premium: PremiumService,
  box: SecretBox,
  vault: TokenVault,
): HostRunner | null {
  const wiring = deps.host;
  if (wiring === undefined) return null;
  const shims = readShims(wiring.mainDir);
  if (shims === null) {
    deps.log.error({ scope: 'premium', event: 'premium.host_unavailable', reason: 'shims_unreadable' });
    return null;
  }
  const rows = createSealedRows(deps.db, box);
  const tracking = wiring.tracking;
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
      store: { subject: () => premium.host.subject(), rows },
      notify: {
        locale: deps.locale,
        now: () => Date.now(),
        // Built when a toast is shown, so nothing of Electron's is touched while wiring.
        show: (toast) => createPremiumNotifier()(toast),
        openPremiumTab: () => {
          wiring.openPremiumTab?.();
        },
      },
      ...(tracking === undefined
        ? {}
        : {
            tracking: {
              rows,
              extensionPath: tracking.extensionPath,
              playingAccountAllows: () => appPlayingAccount.allows(),
              accountKey: () => deps.readGameIdentity()?.accountId ?? null,
              // The game's credentials, the Premium sign-in token and the SteamID: none may reach a worker.
              secrets: cachedSecrets(
                () => [...tracking.gameSecrets(), vault.load()?.token ?? '', deps.readGameIdentity()?.steamId64 ?? ''],
                () => performance.now(),
              ),
              battleLog: tracking.battleLog,
            },
          }),
    },
    playingAccountAllows: () => appPlayingAccount.allows(),
  };
  return (wiring.create ?? createPremiumHost)(parts);
}
