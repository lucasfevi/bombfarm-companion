import type { AppSettings } from './index.js';
import { DEFAULT_SETTINGS } from './index.js';
import { isAppLocale } from './locale.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBooleanFlag(
  record: Record<string, unknown>,
  key: 'alwaysOnTopMain' | 'alwaysOnTopMini',
): boolean | 'missing' | 'invalid' {
  if (!(key in record)) {
    return 'missing';
  }
  const value = record[key];
  if (typeof value === 'boolean') {
    return value;
  }
  return 'invalid';
}

export function migrateStoredSettings(parsed: unknown): AppSettings | null {
  if (!isPlainObject(parsed)) {
    return null;
  }

  const schemaVersion = parsed.schemaVersion;
  if (schemaVersion !== 1 && schemaVersion !== 2) {
    return null;
  }

  if (!isAppLocale(parsed.locale)) {
    return null;
  }

  if (schemaVersion === 1) {
    return {
      schemaVersion: 2,
      locale: parsed.locale,
      alwaysOnTopMain: false,
      alwaysOnTopMini: false,
    };
  }

  const mainFlag = readBooleanFlag(parsed, 'alwaysOnTopMain');
  const miniFlag = readBooleanFlag(parsed, 'alwaysOnTopMini');

  if (mainFlag === 'invalid' || miniFlag === 'invalid') {
    return null;
  }

  return {
    schemaVersion: 2,
    locale: parsed.locale,
    alwaysOnTopMain: mainFlag === 'missing' ? DEFAULT_SETTINGS.alwaysOnTopMain : mainFlag,
    alwaysOnTopMini: miniFlag === 'missing' ? DEFAULT_SETTINGS.alwaysOnTopMini : miniFlag,
  };
}
