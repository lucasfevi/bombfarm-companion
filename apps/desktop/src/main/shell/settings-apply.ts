import type { AppLocale, AppSettings, SettingsWriteResult } from '@bombfarm/contracts';

export function applyLocale(deps: {
  current: AppSettings;
  next: AppLocale;
  persist: (settings: AppSettings) => SettingsWriteResult;
}): SettingsWriteResult {
  const applied: AppSettings = { ...deps.current, schemaVersion: 2, locale: deps.next };
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

  const applied: AppSettings = { ...deps.current, schemaVersion: 2, alwaysOnTopMain: deps.enabled };
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

  const applied: AppSettings = { ...deps.current, schemaVersion: 2, alwaysOnTopMini: deps.enabled };
  deps.setAlwaysOnTop(deps.enabled, 'screen-saver');
  return deps.persist(applied);
}
