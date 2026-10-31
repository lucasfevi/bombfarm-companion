import { safeStorage, shell } from 'electron';
import type { AppLocale, PremiumActionResult, PremiumView } from '@bombfarm/contracts';
import type { LogPort, SqliteDb } from '../storage/index.js';
import { createLicenceService, type LicenceService } from './licence/licence-runner.js';
import { createLicenceStore } from './licence/licence-store.js';
import { createSystemMachineIdentity } from './licence/machine-id.js';
import { createDefaultRemovalPort } from './licence/removal-port.js';
import { startLoopbackListener } from './loopback-listener.js';
import { createPkce, createState } from './pkce.js';
import { appPlayingAccount } from './playing-account-gate.js';
import { createPremiumApi } from './premium-api.js';
import { createPremiumCache } from './premium-cache.js';
import { offlineBytesFetch, offlinePremiumHttp } from './premium-offline.js';
import { createPremiumService, type GameIdentity, type PremiumService } from './premium-service.js';
import { PREMIUM_API_ORIGIN, createBytesFetch, createPremiumHttp, type FetchBytes, type PremiumHttp } from './premium-transport.js';
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
}

/** The Premium service with the licence service built beside it, started and stopped with it. */
export interface ElectronPremium extends PremiumService {
  /** The player pressed "Use Premium on this PC". */
  useHere(): PremiumActionResult;
}

export function createPremiumWhenEnabled(enabled: boolean, deps: ElectronPremiumDeps): ElectronPremium | null {
  return enabled ? createElectronPremium(deps) : null;
}

export function createElectronPremium(deps: ElectronPremiumDeps): ElectronPremium {
  const box = createSafeStorageBox();
  const api = createPremiumApi(chooseHttp(deps.offline, deps.originOverride));
  let licence: LicenceService | null = null;
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
  });
  const service = createLicenceService({
    host: premium.host,
    api,
    store: createLicenceStore(deps.db, box),
    secureStorage: () => box.isAvailable(),
    identity: createSystemMachineIdentity(),
    removal: createDefaultRemovalPort(),
    bytes: chooseBytes(deps.offline, deps.originOverride),
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

  return {
    ...premium,
    start() {
      premium.start();
      service.start();
      stopResume ??= deps.onResume?.(() => {
        service.trigger('resume');
      }) ?? null;
    },
    stop() {
      stopResume?.();
      stopResume = null;
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
  };
}
