import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './index.js';
import { migrateStoredSettings } from './settings-migration.js';

describe('migrateStoredSettings', () => {
  it('migrates a v1 row to v2 with both always-on-top flags false', () => {
    expect(migrateStoredSettings({ schemaVersion: 1, locale: 'pt-BR' })).toEqual({
      schemaVersion: 2,
      locale: 'pt-BR',
      alwaysOnTopMain: false,
      alwaysOnTopMini: false,
    });
  });

  it('returns a well-formed v2 row as-is', () => {
    const stored = {
      schemaVersion: 2,
      locale: 'en' as const,
      alwaysOnTopMain: true,
      alwaysOnTopMini: false,
    };
    expect(migrateStoredSettings(stored)).toEqual(stored);
  });

  it('preserves alwaysOnTopMini when it is true on a v2 row', () => {
    expect(
      migrateStoredSettings({
        schemaVersion: 2,
        locale: 'en',
        alwaysOnTopMain: false,
        alwaysOnTopMini: true,
      }),
    ).toEqual({
      schemaVersion: 2,
      locale: 'en',
      alwaysOnTopMain: false,
      alwaysOnTopMini: true,
    });
  });

  it('fills missing always-on-top flags from DEFAULT_SETTINGS on a v2 row', () => {
    expect(migrateStoredSettings({ schemaVersion: 2, locale: 'en' })).toEqual({
      schemaVersion: 2,
      locale: 'en',
      alwaysOnTopMain: DEFAULT_SETTINGS.alwaysOnTopMain,
      alwaysOnTopMini: DEFAULT_SETTINGS.alwaysOnTopMini,
    });
  });

  it('returns null for an unknown future schema version', () => {
    expect(migrateStoredSettings({ schemaVersion: 99, locale: 'en' })).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(migrateStoredSettings(null)).toBeNull();
    expect(migrateStoredSettings('not-json')).toBeNull();
    expect(migrateStoredSettings([])).toBeNull();
  });

  it('returns null when locale is missing or invalid', () => {
    expect(migrateStoredSettings({ schemaVersion: 2, locale: 'fr' })).toBeNull();
    expect(migrateStoredSettings({ schemaVersion: 2 })).toBeNull();
  });

  it('returns null when a present always-on-top flag is not a boolean', () => {
    expect(
      migrateStoredSettings({
        schemaVersion: 2,
        locale: 'en',
        alwaysOnTopMain: 'yes',
        alwaysOnTopMini: false,
      }),
    ).toBeNull();
    expect(
      migrateStoredSettings({
        schemaVersion: 2,
        locale: 'en',
        alwaysOnTopMain: false,
        alwaysOnTopMini: 1,
      }),
    ).toBeNull();
  });
});
