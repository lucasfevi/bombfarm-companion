import type { AppLocale, AppSettings, SettingsWriteResult } from '@bombfarm/contracts';

export function applyLocale(deps: {
  current: AppSettings;
  next: AppLocale;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  const applied: AppSettings = { ...deps.current, schemaVersion: 3, locale: deps.next };
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

  const applied: AppSettings = { ...deps.current, schemaVersion: 3, alwaysOnTopMain: deps.enabled };
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

  const applied: AppSettings = { ...deps.current, schemaVersion: 3, alwaysOnTopMini: deps.enabled };
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

  const applied: AppSettings = { ...deps.current, schemaVersion: 3, forgeWritesEnabled: deps.enabled };
  return deps.persist(applied);
}

export function applyRestartGameOnExit(deps: {
  current: AppSettings;
  enabled: unknown;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  if (typeof deps.enabled !== 'boolean') {
    return { settings: deps.current, persisted: true, reason: null };
  }

  const applied: AppSettings = { ...deps.current, schemaVersion: 3, restartGameOnExit: deps.enabled };
  return deps.persist(applied);
}
