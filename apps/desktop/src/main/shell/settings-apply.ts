import type { AppLocale, AppSettings, SettingsWriteResult, StartWithWindowsWriteResult } from '@bombfarm/contracts';
import { DEFAULT_SETTINGS, isMarketQuoteCurrency } from '@bombfarm/contracts';
import type { LoginItemOutcome } from './login-item.js';

export function applyLocale(deps: {
  current: AppSettings;
  next: AppLocale;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  const applied: AppSettings = { ...deps.current, schemaVersion: DEFAULT_SETTINGS.schemaVersion, locale: deps.next };
  return deps.persist(applied);
}

export function applyAlwaysOnTopMain(deps: {
  current: AppSettings;
  enabled: unknown;
  setAlwaysOnTop: (enabled: boolean, level: 'normal') => void;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  if (typeof deps.enabled !== 'boolean') {
    return { settings: deps.current, persisted: true, reason: null };
  }

  const applied: AppSettings = { ...deps.current, schemaVersion: DEFAULT_SETTINGS.schemaVersion, alwaysOnTopMain: deps.enabled };
  deps.setAlwaysOnTop(deps.enabled, 'normal');
  return deps.persist(applied);
}

export function applyAlwaysOnTopMini(deps: {
  current: AppSettings;
  enabled: unknown;
  setAlwaysOnTop: (enabled: boolean, level: 'screen-saver') => void;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  if (typeof deps.enabled !== 'boolean') {
    return { settings: deps.current, persisted: true, reason: null };
  }

  const applied: AppSettings = { ...deps.current, schemaVersion: DEFAULT_SETTINGS.schemaVersion, alwaysOnTopMini: deps.enabled };
  deps.setAlwaysOnTop(deps.enabled, 'screen-saver');
  return deps.persist(applied);
}

export function applyForgeWritesEnabled(deps: {
  current: AppSettings;
  enabled: unknown;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  if (typeof deps.enabled !== 'boolean') {
    return { settings: deps.current, persisted: true, reason: null };
  }

  const applied: AppSettings = { ...deps.current, schemaVersion: DEFAULT_SETTINGS.schemaVersion, forgeWritesEnabled: deps.enabled };
  return deps.persist(applied);
}

export function applyRestartGameOnExit(deps: {
  current: AppSettings;
  enabled: unknown;
  setEnabled: (enabled: boolean) => void;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  if (typeof deps.enabled !== 'boolean') {
    return { settings: deps.current, persisted: true, reason: null };
  }

  const applied: AppSettings = { ...deps.current, schemaVersion: DEFAULT_SETTINGS.schemaVersion, restartGameOnExit: deps.enabled };
  deps.setEnabled(deps.enabled);
  return deps.persist(applied);
}

export function applyMarketQuoteCurrency(deps: {
  current: AppSettings;
  next: unknown;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  if (!isMarketQuoteCurrency(deps.next)) {
    return { settings: deps.current, persisted: true, reason: null };
  }

  const applied: AppSettings = { ...deps.current, schemaVersion: DEFAULT_SETTINGS.schemaVersion, marketQuoteCurrency: deps.next };
  return deps.persist(applied);
}

export function applyUsagePingEnabled(deps: {
  current: AppSettings;
  enabled: unknown;
  setEnabled: (enabled: boolean) => void;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  if (typeof deps.enabled !== 'boolean') {
    return { settings: deps.current, persisted: true, reason: null };
  }

  const applied: AppSettings = { ...deps.current, schemaVersion: DEFAULT_SETTINGS.schemaVersion, usagePingEnabled: deps.enabled };
  deps.setEnabled(deps.enabled);
  return deps.persist(applied);
}

/**
 * Guard, apply, reconcile the OS login item, persist. The two failures are independent: the row may
 * not be written while Windows accepted the entry, or the row may be written while Windows refused.
 */
export function applyStartWithWindows(deps: {
  current: AppSettings;
  enabled: unknown;
  reconcile: (startWithWindows: boolean) => LoginItemOutcome;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): StartWithWindowsWriteResult {
  if (typeof deps.enabled !== 'boolean') {
    return { settings: deps.current, persisted: true, reason: null, loginItem: null };
  }

  const applied: AppSettings = { ...deps.current, schemaVersion: DEFAULT_SETTINGS.schemaVersion, startWithWindows: deps.enabled };
  const outcome = deps.reconcile(deps.enabled);
  const written = deps.persist(applied);
  return { ...written, loginItem: outcome.applied ? null : outcome.block };
}
