import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, type AppSettings, type SettingsWriteReason, type SettingsWriteResult } from '@bombfarm/contracts';
import {
  createSettingsHandlers,
  loadStoredSettings,
  SETTINGS_FIELDS,
  type SettingsField,
  type SettingsHandlers,
  type SettingsSink,
} from './settings-handlers';

type Bridge = NonNullable<Window['bfc']>;
type Call = readonly [string, ...unknown[]];

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function recordingSink() {
  const applied = Object.fromEntries(SETTINGS_FIELDS.map((field) => [field, [] as unknown[]])) as Record<SettingsField, unknown[]>;
  const warned = Object.fromEntries(SETTINGS_FIELDS.map((field) => [field, [] as (SettingsWriteReason | null)[]])) as Record<
    SettingsField,
    (SettingsWriteReason | null)[]
  >;
  const sink = Object.fromEntries(
    SETTINGS_FIELDS.map((field) => [
      field,
      {
        apply: (value: unknown) => {
          applied[field].push(value);
        },
        warn: (reason: SettingsWriteReason | null) => {
          warned[field].push(reason);
        },
      },
    ]),
  ) as unknown as SettingsSink;
  const touched = (): SettingsField[] => SETTINGS_FIELDS.filter((field) => applied[field].length > 0 || warned[field].length > 0);
  return { sink, applied, warned, touched };
}

function recordingBridge(answer: (channel: string) => unknown) {
  const calls: Call[] = [];
  const invoke = vi.fn((channel: string, ...args: unknown[]) => {
    calls.push([channel, ...args]);
    return answer(channel);
  });
  return { bridge: { invoke } as unknown as Bridge, calls };
}

function writeResult(settings: AppSettings, persisted: boolean, reason: SettingsWriteReason | null): SettingsWriteResult {
  return { settings, persisted, reason };
}

interface Drive {
  readonly field: SettingsField;
  /** The one call the handler is allowed to make, channel first. */
  readonly expectedCall: Call;
  readonly argument: unknown;
  /** What main echoes back — deliberately not the argument the handler was handed. */
  readonly answeredSettings: AppSettings;
  readonly answeredValue: unknown;
  readonly drive: (handlers: SettingsHandlers) => void;
}

const DRIVES: readonly Drive[] = [
  {
    field: 'locale',
    expectedCall: ['settings:usePortuguese'],
    argument: 'pt-BR',
    answeredSettings: { ...DEFAULT_SETTINGS, locale: 'en' },
    answeredValue: 'en',
    drive: (handlers) => {
      handlers.onLocaleChange('pt-BR');
    },
  },
  {
    field: 'alwaysOnTopMain',
    expectedCall: ['settings:setAlwaysOnTopMain', true],
    argument: true,
    answeredSettings: { ...DEFAULT_SETTINGS, alwaysOnTopMain: false },
    answeredValue: false,
    drive: (handlers) => {
      handlers.onAlwaysOnTopMainChange(true);
    },
  },
  {
    field: 'alwaysOnTopMini',
    expectedCall: ['settings:setAlwaysOnTopMini', true],
    argument: true,
    answeredSettings: { ...DEFAULT_SETTINGS, alwaysOnTopMini: false },
    answeredValue: false,
    drive: (handlers) => {
      handlers.onAlwaysOnTopMiniChange(true);
    },
  },
  {
    field: 'forgeWritesEnabled',
    expectedCall: ['settings:setForgeWritesEnabled', true],
    argument: true,
    answeredSettings: { ...DEFAULT_SETTINGS, forgeWritesEnabled: false },
    answeredValue: false,
    drive: (handlers) => {
      handlers.onForgeWritesEnabledChange(true);
    },
  },
  {
    field: 'restartGameOnExit',
    expectedCall: ['settings:setRestartGameOnExit', true],
    argument: true,
    answeredSettings: { ...DEFAULT_SETTINGS, restartGameOnExit: false },
    answeredValue: false,
    drive: (handlers) => {
      handlers.onRestartGameOnExitChange(true);
    },
  },
  {
    field: 'marketQuoteCurrency',
    expectedCall: ['settings:setMarketQuoteCurrency', 'EUR'],
    argument: 'EUR',
    answeredSettings: { ...DEFAULT_SETTINGS, marketQuoteCurrency: 'USD' },
    answeredValue: 'USD',
    drive: (handlers) => {
      handlers.onMarketQuoteCurrencyChange('EUR');
    },
  },
  {
    field: 'usagePingEnabled',
    expectedCall: ['settings:setUsagePingEnabled', false],
    argument: false,
    answeredSettings: { ...DEFAULT_SETTINGS, usagePingEnabled: true },
    answeredValue: true,
    drive: (handlers) => {
      handlers.onUsagePingEnabledChange(false);
    },
  },
];

/** Every stored field differing from its default, so a read proves it came from the answer. */
const STORED: AppSettings = {
  schemaVersion: 4,
  locale: 'pt-BR',
  alwaysOnTopMain: true,
  alwaysOnTopMini: true,
  forgeWritesEnabled: true,
  restartGameOnExit: true,
  marketQuoteCurrency: 'EUR',
  usagePingEnabled: false,
};

const ALL_HANDLERS: readonly ((handlers: SettingsHandlers) => void)[] = DRIVES.map((entry) => entry.drive);

describe('the settings field table', () => {
  it('names the seven stored fields this screen writes, and no others', () => {
    expect([...SETTINGS_FIELDS].sort()).toEqual(
      [
        'alwaysOnTopMain',
        'alwaysOnTopMini',
        'forgeWritesEnabled',
        'locale',
        'marketQuoteCurrency',
        'restartGameOnExit',
        'usagePingEnabled',
      ].sort(),
    );
  });

  it('is driven end to end by this file, with one handler exercised per field', () => {
    expect(DRIVES.map((entry) => entry.field).sort()).toEqual([...SETTINGS_FIELDS].sort());
  });
});

describe('createSettingsHandlers', () => {
  it('sends each write down a channel of its own, with the new value as the single argument', async () => {
    const { sink } = recordingSink();
    const { bridge, calls } = recordingBridge(() => Promise.resolve(writeResult(DEFAULT_SETTINGS, true, null)));
    const handlers = createSettingsHandlers(() => bridge, sink);

    for (const drive of ALL_HANDLERS) drive(handlers);
    await flush();

    expect(new Set(calls.map((call) => JSON.stringify(call)))).toEqual(
      new Set(DRIVES.map((entry) => JSON.stringify(entry.expectedCall))),
    );
    expect(calls).toHaveLength(DRIVES.length);
  });

  it('picks the Portuguese channel for pt-BR and the English one for en', async () => {
    const { sink } = recordingSink();
    const { bridge, calls } = recordingBridge(() => Promise.resolve(writeResult(DEFAULT_SETTINGS, true, null)));
    const handlers = createSettingsHandlers(() => bridge, sink);

    handlers.onLocaleChange('pt-BR');
    handlers.onLocaleChange('en');
    await flush();

    expect(calls).toEqual([['settings:usePortuguese'], ['settings:useEnglish']]);
  });

  it.each(DRIVES.map((entry) => [entry.field, entry] as const))(
    'applies the value main echoed back for %s, not the one it was handed',
    async (_field, entry) => {
      const { sink, applied } = recordingSink();
      const { bridge } = recordingBridge(() => Promise.resolve(writeResult(entry.answeredSettings, true, null)));

      entry.drive(createSettingsHandlers(() => bridge, sink));
      await flush();

      expect(entry.answeredValue).not.toEqual(entry.argument);
      expect(applied[entry.field]).toEqual([entry.answeredValue]);
    },
  );

  it.each(DRIVES.map((entry) => [entry.field, entry] as const))(
    'warns with the reason when the %s write did not persist, and with null when it did',
    async (_field, entry) => {
      const unpersisted = recordingSink();
      const persisted = recordingSink();
      const refusing = recordingBridge(() => Promise.resolve(writeResult(entry.answeredSettings, false, 'not_writable')));
      const accepting = recordingBridge(() => Promise.resolve(writeResult(entry.answeredSettings, true, null)));

      entry.drive(createSettingsHandlers(() => refusing.bridge, unpersisted.sink));
      entry.drive(createSettingsHandlers(() => accepting.bridge, persisted.sink));
      await flush();

      expect(unpersisted.warned[entry.field]).toEqual(['not_writable']);
      expect(persisted.warned[entry.field]).toEqual([null]);
    },
  );

  it.each(DRIVES.map((entry) => [entry.field, entry] as const))(
    'touches the %s pair and no other field when that write answers',
    async (field, entry) => {
      const { sink, touched } = recordingSink();
      const { bridge } = recordingBridge(() => Promise.resolve(writeResult(entry.answeredSettings, false, 'no_store')));

      entry.drive(createSettingsHandlers(() => bridge, sink));
      await flush();

      expect(touched(), `fields also touched: ${touched().filter((other) => other !== field).join(', ')}`).toEqual([field]);
    },
  );

  it('is a silent no-op in every handler while the bridge is absent', async () => {
    const { sink, touched } = recordingSink();
    const handlers = createSettingsHandlers(() => null, sink);

    for (const drive of ALL_HANDLERS) expect(() => {
      drive(handlers);
    }).not.toThrow();
    await flush();

    expect(touched()).toEqual([]);
  });

  it('reads the bridge at call time, so a handler built before preload still reaches IPC afterwards', async () => {
    const { sink, applied } = recordingSink();
    const { bridge, calls } = recordingBridge(() =>
      Promise.resolve(writeResult({ ...DEFAULT_SETTINGS, alwaysOnTopMain: true }, true, null)),
    );
    let answers = 0;
    const handlers = createSettingsHandlers(() => (answers++ === 0 ? null : bridge), sink);

    handlers.onAlwaysOnTopMainChange(true);
    await flush();
    expect(calls).toEqual([]);
    expect(applied.alwaysOnTopMain).toEqual([]);

    handlers.onAlwaysOnTopMainChange(true);
    await flush();
    expect(calls).toEqual([['settings:setAlwaysOnTopMain', true]]);
    expect(applied.alwaysOnTopMain).toEqual([true]);
  });
});

describe('loadStoredSettings', () => {
  it('applies all seven stored fields from the initial read', async () => {
    const { sink, applied } = recordingSink();
    const { bridge, calls } = recordingBridge(() => Promise.resolve(STORED));

    loadStoredSettings(() => bridge, sink);
    await flush();

    expect(calls).toEqual([['settings:get']]);
    expect(Object.fromEntries(SETTINGS_FIELDS.map((field) => [field, applied[field]]))).toEqual({
      locale: ['pt-BR'],
      alwaysOnTopMain: [true],
      alwaysOnTopMini: [true],
      forgeWritesEnabled: [true],
      restartGameOnExit: [true],
      marketQuoteCurrency: ['EUR'],
      usagePingEnabled: [false],
    });
  });

  it('reports no persistence on the initial read, which wrote nothing', async () => {
    const { sink, warned } = recordingSink();
    const { bridge } = recordingBridge(() => Promise.resolve(STORED));

    loadStoredSettings(() => bridge, sink);
    await flush();

    expect(SETTINGS_FIELDS.filter((field) => warned[field].length > 0)).toEqual([]);
  });

  it('falls back to the default locale alone when there is no bridge', async () => {
    const { sink, applied, touched } = recordingSink();

    expect(() => {
      loadStoredSettings(() => null, sink);
    }).not.toThrow();
    await flush();

    expect(touched()).toEqual(['locale']);
    expect(applied.locale).toEqual([DEFAULT_SETTINGS.locale]);
  });

  it('falls back to the default locale alone when the read rejects, without rejecting outward', async () => {
    const { sink, applied, touched } = recordingSink();
    const { bridge } = recordingBridge(() => Promise.reject(new Error('no store')));

    expect(() => {
      loadStoredSettings(() => bridge, sink);
    }).not.toThrow();
    await flush();

    expect(touched()).toEqual(['locale']);
    expect(applied.locale).toEqual([DEFAULT_SETTINGS.locale]);
  });
});
