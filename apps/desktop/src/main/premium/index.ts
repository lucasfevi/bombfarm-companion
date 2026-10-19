import { safeStorage, shell } from 'electron';
import type { AppLocale, PremiumView } from '@bombfarm/contracts';
import type { LogPort, SqliteDb } from '../storage/index.js';
import { startLoopbackListener } from './loopback-listener.js';
import { createPkce, createState } from './pkce.js';
import { createPremiumApi } from './premium-api.js';
import { createPremiumCache } from './premium-cache.js';
import { offlinePremiumHttp } from './premium-offline.js';
import { createPremiumService, type GameIdentity, type PremiumService } from './premium-service.js';
import { PREMIUM_API_ORIGIN, createPremiumHttp, type PremiumHttp } from './premium-transport.js';
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

export interface ElectronPremiumDeps {
  readonly db: SqliteDb | null;
  readonly originOverride: string | null;
  readonly offline: boolean;
  readonly readGameIdentity: () => GameIdentity | null;
  readonly locale: () => AppLocale;
  readonly log: LogPort;
  readonly onChanged: (view: PremiumView) => void;
}

export function createPremiumWhenEnabled(enabled: boolean, deps: ElectronPremiumDeps): PremiumService | null {
  return enabled ? createElectronPremium(deps) : null;
}

export function createElectronPremium(deps: ElectronPremiumDeps): PremiumService {
  return createPremiumService({
    api: createPremiumApi(chooseHttp(deps.offline, deps.originOverride)),
    vault: createTokenVault(deps.db, createSafeStorageBox()),
    cache: createPremiumCache(deps.db),
    openExternal: (url) => shell.openExternal(url),
    readGameIdentity: deps.readGameIdentity,
    startListener: startLoopbackListener,
    locale: deps.locale,
    pkce: { createPkce, createState },
    now: () => Date.now(),
    log: deps.log,
    onChanged: deps.onChanged,
  });
}
