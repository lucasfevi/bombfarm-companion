import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings } from './index.js';
import { migrateStoredSettings, SETTINGS_SCHEMA_VERSIONS } from './settings-migration.js';

describe('migrateStoredSettings', () => {
  it('migrates a v1 row to the current schema with every flag false and the default market currency', () => {
    expect(migrateStoredSettings({ schemaVersion: 1, locale: 'pt-BR' })).toEqual({
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      locale: 'pt-BR',
      alwaysOnTopMain: false,
      alwaysOnTopMini: false,
      forgeWritesEnabled: false,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
      startWithWindows: true,
    });
  });

  it('migrates a v2 row to the current schema with forge writes off — the switch never comes on by migration', () => {
    expect(
      migrateStoredSettings({
        schemaVersion: 2,
        locale: 'en',
        alwaysOnTopMain: true,
        alwaysOnTopMini: false,
      }),
    ).toEqual({
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      locale: 'en',
      alwaysOnTopMain: true,
      alwaysOnTopMini: false,
      forgeWritesEnabled: false,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
      startWithWindows: true,
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
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: true,
      forgeWritesEnabled: true,
      restartGameOnExit: true,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
      startWithWindows: true,
    });
  });

  it('reads a well-formed v4 row forward with every stored value kept, the chosen currency included', () => {
    const stored = {
      schemaVersion: 4,
      locale: 'en' as const,
      alwaysOnTopMain: true,
      alwaysOnTopMini: false,
      forgeWritesEnabled: true,
      restartGameOnExit: true,
      marketQuoteCurrency: 'USD' as const,
      usagePingEnabled: false,
    };
    expect(migrateStoredSettings(stored)).toEqual({
      ...stored,
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      startWithWindows: true,
    });
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
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: false,
      forgeWritesEnabled: true,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
      startWithWindows: true,
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
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      locale: 'en',
      alwaysOnTopMain: false,
      alwaysOnTopMini: true,
      forgeWritesEnabled: false,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
      startWithWindows: true,
    });
  });

  it('fills missing fields from DEFAULT_SETTINGS on a v2, v3 or v4 row', () => {
    for (const schemaVersion of [2, 3, 4]) {
      expect(migrateStoredSettings({ schemaVersion, locale: 'en' })).toEqual({
        schemaVersion: DEFAULT_SETTINGS.schemaVersion,
        locale: 'en',
        alwaysOnTopMain: DEFAULT_SETTINGS.alwaysOnTopMain,
        alwaysOnTopMini: DEFAULT_SETTINGS.alwaysOnTopMini,
        forgeWritesEnabled: DEFAULT_SETTINGS.forgeWritesEnabled,
        restartGameOnExit: DEFAULT_SETTINGS.restartGameOnExit,
        marketQuoteCurrency: DEFAULT_SETTINGS.marketQuoteCurrency,
        usagePingEnabled: DEFAULT_SETTINGS.usagePingEnabled,
        startWithWindows: true,
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
      schemaVersion: DEFAULT_SETTINGS.schemaVersion,
      locale: 'pt-BR',
      alwaysOnTopMain: true,
      alwaysOnTopMini: true,
      forgeWritesEnabled: true,
      restartGameOnExit: false,
      marketQuoteCurrency: 'BRL',
      usagePingEnabled: true,
      startWithWindows: true,
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

describe('migrateStoredSettings — usagePingEnabled', () => {
  const v4 = {
    schemaVersion: 4,
    locale: 'pt-BR',
    alwaysOnTopMain: false,
    alwaysOnTopMini: false,
    forgeWritesEnabled: false,
    restartGameOnExit: false,
    marketQuoteCurrency: 'BRL',
  };

  it('an install that predates the switch updates with it on', () => {
    expect(migrateStoredSettings(v4)?.usagePingEnabled).toBe(true);
  });

  it('a player who turned it off stays off across an update', () => {
    expect(migrateStoredSettings({ ...v4, usagePingEnabled: false })?.usagePingEnabled).toBe(false);
  });

  it('a stored value that is not a boolean discards the row rather than guessing', () => {
    expect(migrateStoredSettings({ ...v4, usagePingEnabled: 'off' })).toBeNull();
  });
});

/** What each stored version introduced, every value away from its default so a migration that
 *  hands back defaults cannot pass. The historical keys are absolute — they name shapes that
 *  shipped. Everything else here is relative to the current version. */
const INTRODUCED_BY: Record<number, Partial<AppSettings>> = {
  1: { locale: 'pt-BR' },
  2: { alwaysOnTopMain: true, alwaysOnTopMini: true },
  3: { forgeWritesEnabled: true, restartGameOnExit: true },
  4: { marketQuoteCurrency: 'USD', usagePingEnabled: false },
  5: { startWithWindows: false },
};

function rowAt(version: number): Record<string, unknown> {
  let row: Record<string, unknown> = { schemaVersion: version };
  for (const [introducedAt, fields] of Object.entries(INTRODUCED_BY)) {
    if (Number(introducedAt) <= version) {
      row = { ...row, ...fields };
    }
  }
  return row;
}

describe('migrateStoredSettings — every earlier version reads forward', () => {
  it('the table has a row for exactly the versions the migration accepts', () => {
    expect(Object.keys(INTRODUCED_BY).map(Number)).toEqual([...SETTINGS_SCHEMA_VERSIONS]);
  });

  it('the accepted versions are the consecutive range 1 to the current schema version', () => {
    expect([...SETTINGS_SCHEMA_VERSIONS]).toEqual(
      Array.from({ length: DEFAULT_SETTINGS.schemaVersion }, (_, index) => index + 1),
    );
  });

  it('every settings field is attributed to some version in the table', () => {
    const attributed = new Set(Object.values(INTRODUCED_BY).flatMap((fields) => Object.keys(fields)));
    const unattributed = Object.keys(DEFAULT_SETTINGS).filter(
      (key) => key !== 'schemaVersion' && !attributed.has(key),
    );
    expect(unattributed).toEqual([]);
  });

  it('every attributed field is held away from its default, so defaults cannot satisfy the table', () => {
    for (const fields of Object.values(INTRODUCED_BY)) {
      for (const [key, value] of Object.entries(fields)) {
        expect(value, key).not.toEqual(DEFAULT_SETTINGS[key as keyof AppSettings]);
      }
    }
  });

  it.each([...SETTINGS_SCHEMA_VERSIONS])(
    'a version %i row keeps every field it stored and defaults every later one',
    (version) => {
      const migrated = migrateStoredSettings(rowAt(version));

      const expected: Record<string, unknown> = { ...DEFAULT_SETTINGS };
      for (const [introducedAt, fields] of Object.entries(INTRODUCED_BY)) {
        if (Number(introducedAt) <= version) {
          Object.assign(expected, fields);
        }
      }
      expect(migrated).toEqual({ ...expected, schemaVersion: DEFAULT_SETTINGS.schemaVersion });
    },
  );

  it('a row already at the current version comes back unchanged', () => {
    const current = rowAt(DEFAULT_SETTINGS.schemaVersion);
    expect(migrateStoredSettings(current)).toEqual(current);
  });

  it('a version one past the current one is refused, not guessed at', () => {
    expect(migrateStoredSettings({ ...rowAt(DEFAULT_SETTINGS.schemaVersion), schemaVersion: DEFAULT_SETTINGS.schemaVersion + 1 })).toBeNull();
  });

  it('a version that is not a whole listed number is refused', () => {
    expect(migrateStoredSettings({ ...rowAt(1), schemaVersion: 0 })).toBeNull();
    expect(migrateStoredSettings({ ...rowAt(1), schemaVersion: 1.5 })).toBeNull();
    expect(migrateStoredSettings({ ...rowAt(1), schemaVersion: '5' })).toBeNull();
  });
});

describe('migrateStoredSettings — startWithWindows', () => {
  const v4 = rowAt(4);

  it('an install that predates the setting updates with it on', () => {
    expect(migrateStoredSettings(v4)?.startWithWindows).toBe(true);
  });

  it('a player who turned it off stays off across an update', () => {
    expect(migrateStoredSettings({ ...v4, startWithWindows: false })?.startWithWindows).toBe(false);
  });

  it('a stored value that is not a boolean discards the row rather than guessing', () => {
    expect(migrateStoredSettings({ ...v4, startWithWindows: 'off' })).toBeNull();
    expect(migrateStoredSettings({ ...v4, startWithWindows: 0 })).toBeNull();
  });
});
