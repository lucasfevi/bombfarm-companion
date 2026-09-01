import type { AppLocale, AppSettings, SettingsWriteResult } from '@bombfarm/contracts';

/** One path: spread the current object, apply the locale, then persist. */
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
