import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './index.js';
import { migrateStoredSettings } from './settings-migration.js';

describe('migrateStoredSettings', () => {
  it('migrates a v1 row to v4 with every flag false and the default market currency', () => {
    expect(migrateStoredSettings({ schemaVersion: 1, locale: 'pt-BR' })).toEqual({
      schemaVersion: 4,
      locale: 'pt-BR',
      alwaysOnTopMain: false,
      alwaysOnTopMini: false,
      forgeWritesEnabled: false,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
    });
  });

  it('migrates a v2 row to v4 with forge writes off — the switch never comes on by migration', () => {
    expect(
      migrateStoredSettings({
        schemaVersion: 2,
        locale: 'en',
        alwaysOnTopMain: true,
        alwaysOnTopMini: false,
      }),
    ).toEqual({
      schemaVersion: 4,
      locale: 'en',
      alwaysOnTopMain: true,
      alwaysOnTopMini: false,
      forgeWritesEnabled: false,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
    });
  });

  it('migrates a v3 row to v4 quoting in BRL — what every install quoted in before the setting existed', () => {
    expect(
      migrateStoredSettings({
        schemaVersion: 3,
        locale: 'pt-BR',
        alwaysOnTopMain: true,
        alwaysOnTopMini: true,
        forgeWritesEnabled: true,
        restartGameOnExit: true,
      }),
    ).toEqual({
      schemaVersion: 4,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: true,
      forgeWritesEnabled: true,
      restartGameOnExit: true,
      marketQuoteCurrency: 'BRL',
    });
  });

  it('returns a well-formed v4 row as-is, the chosen currency included', () => {
    const stored = {
      schemaVersion: 4,
      locale: 'en' as const,
      alwaysOnTopMain: true,
      alwaysOnTopMini: false,
      forgeWritesEnabled: true,
      restartGameOnExit: true,
      marketQuoteCurrency: 'USD' as const,
    };
    expect(migrateStoredSettings(stored)).toEqual(stored);
  });

  it('a stored currency this build no longer offers falls back to the default without discarding the row', () => {
    expect(
      migrateStoredSettings({
        schemaVersion: 4,
        locale: 'pt-BR',
        alwaysOnTopMain: true,
        alwaysOnTopMini: false,
        forgeWritesEnabled: true,
        restartGameOnExit: false,
        marketQuoteCurrency: 'SEK',
      }),
    ).toEqual({
      schemaVersion: 4,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: false,
      forgeWritesEnabled: true,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
    });
  });

  it('returns null when the stored currency is not a string at all', () => {
    expect(
      migrateStoredSettings({
        schemaVersion: 4,
        locale: 'en',
        marketQuoteCurrency: 7,
      }),
    ).toBeNull();
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
      schemaVersion: 4,
      locale: 'en',
      alwaysOnTopMain: false,
      alwaysOnTopMini: true,
      forgeWritesEnabled: false,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
    });
  });

  it('fills missing fields from DEFAULT_SETTINGS on a v2, v3 or v4 row', () => {
    for (const schemaVersion of [2, 3, 4]) {
      expect(migrateStoredSettings({ schemaVersion, locale: 'en' })).toEqual({
        schemaVersion: 4,
        locale: 'en',
        alwaysOnTopMain: DEFAULT_SETTINGS.alwaysOnTopMain,
        alwaysOnTopMini: DEFAULT_SETTINGS.alwaysOnTopMini,
        forgeWritesEnabled: DEFAULT_SETTINGS.forgeWritesEnabled,
        restartGameOnExit: DEFAULT_SETTINGS.restartGameOnExit,
        marketQuoteCurrency: DEFAULT_SETTINGS.marketQuoteCurrency,
      });
    }
  });

  it('fills a missing restartGameOnExit with false while preserving every other stored field', () => {
    expect(
      migrateStoredSettings({
        schemaVersion: 3,
        locale: 'pt-BR',
        alwaysOnTopMain: true,
        alwaysOnTopMini: true,
        forgeWritesEnabled: true,
      }),
    ).toEqual({
      schemaVersion: 4,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: true,
      forgeWritesEnabled: true,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
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
    expect(migrateStoredSettings({ schemaVersion: 3, locale: 'fr' })).toBeNull();
    expect(migrateStoredSettings({ schemaVersion: 3 })).toBeNull();
  });

  it('returns null when a present flag is not a boolean', () => {
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
    expect(
      migrateStoredSettings({
        schemaVersion: 3,
        locale: 'en',
        alwaysOnTopMain: false,
        alwaysOnTopMini: false,
        forgeWritesEnabled: 'on',
      }),
    ).toBeNull();
    expect(
      migrateStoredSettings({
        schemaVersion: 3,
        locale: 'en',
        alwaysOnTopMain: false,
        alwaysOnTopMini: false,
        forgeWritesEnabled: false,
        restartGameOnExit: 'yes',
      }),
    ).toBeNull();
    expect(
      migrateStoredSettings({
        schemaVersion: 3,
        locale: 'en',
        restartGameOnExit: 1,
      }),
    ).toBeNull();
  });
});
