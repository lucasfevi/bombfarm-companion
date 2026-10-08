import type { AppLocale, AppSettings, MarketQuoteCurrency, SettingsWriteReason, SettingsWriteResult } from '@bombfarm/contracts';
import { DEFAULT_SETTINGS } from '@bombfarm/contracts';

type Bridge = NonNullable<Window['bfc']>;

/** The seven stored fields this screen writes, each through a channel of its own. */
export const SETTINGS_FIELDS = [
  'locale',
  'alwaysOnTopMain',
  'alwaysOnTopMini',
  'forgeWritesEnabled',
  'restartGameOnExit',
  'marketQuoteCurrency',
  'usagePingEnabled',
] as const satisfies readonly (keyof AppSettings)[];

export type SettingsField = (typeof SETTINGS_FIELDS)[number];

/**
 * One applier and one warner per field. The pairing is the contract: a write reports its own
 * field's persistence and no other's.
 */
export type SettingsSink = {
  readonly [K in SettingsField]: {
    readonly apply: (value: AppSettings[K]) => void;
    readonly warn: (reason: SettingsWriteReason | null) => void;
  };
};

export interface SettingsHandlers {
  readonly onLocaleChange: (next: AppLocale) => void;
  readonly onAlwaysOnTopMainChange: (next: boolean) => void;
  readonly onAlwaysOnTopMiniChange: (next: boolean) => void;
  readonly onForgeWritesEnabledChange: (next: boolean) => void;
  readonly onRestartGameOnExitChange: (next: boolean) => void;
  readonly onMarketQuoteCurrencyChange: (next: MarketQuoteCurrency) => void;
  readonly onUsagePingEnabledChange: (next: boolean) => void;
}

/**
 * `getBridge` is a getter, not a bridge: preload has not run when this module is wired up, so a
 * value captured then would be null for the life of the screen.
 */
export function loadStoredSettings(getBridge: () => Bridge | null, sink: SettingsSink): void {
  const bridge = getBridge();
  if (!bridge) {
    sink.locale.apply(DEFAULT_SETTINGS.locale);
    return;
  }
  void bridge
    .invoke('settings:get')
    .then((settings) => {
      sink.locale.apply(settings.locale);
      sink.alwaysOnTopMain.apply(settings.alwaysOnTopMain);
      sink.alwaysOnTopMini.apply(settings.alwaysOnTopMini);
      sink.forgeWritesEnabled.apply(settings.forgeWritesEnabled);
      sink.restartGameOnExit.apply(settings.restartGameOnExit);
      sink.marketQuoteCurrency.apply(settings.marketQuoteCurrency);
      sink.usagePingEnabled.apply(settings.usagePingEnabled);
    })
    .catch(() => {
      sink.locale.apply(DEFAULT_SETTINGS.locale);
    });
}

/** `Pick` rather than the whole sink: this helper can reach one field's pair and no other's. */
function settleField<K extends SettingsField>(sink: Pick<SettingsSink, K>, field: K, result: SettingsWriteResult): void {
  // The value main echoed back, never the argument that was passed in: `result.settings` is the
  // applied state on every branch, including the one that failed to persist.
  sink[field].apply(result.settings[field]);
  sink[field].warn(result.persisted ? null : result.reason);
}

export function createSettingsHandlers(getBridge: () => Bridge | null, sink: SettingsSink): SettingsHandlers {
  const write = (field: SettingsField, invoke: (bridge: Bridge) => Promise<SettingsWriteResult>): void => {
    const bridge = getBridge();
    if (!bridge) return;
    void invoke(bridge).then((result) => {
      settleField(sink, field, result);
    });
  };

  return {
    onLocaleChange: (next) => {
      write('locale', (bridge) => bridge.invoke(next === 'pt-BR' ? 'settings:usePortuguese' : 'settings:useEnglish'));
    },
    onAlwaysOnTopMainChange: (next) => {
      write('alwaysOnTopMain', (bridge) => bridge.invoke('settings:setAlwaysOnTopMain', next));
    },
    onAlwaysOnTopMiniChange: (next) => {
      write('alwaysOnTopMini', (bridge) => bridge.invoke('settings:setAlwaysOnTopMini', next));
    },
    onForgeWritesEnabledChange: (next) => {
      write('forgeWritesEnabled', (bridge) => bridge.invoke('settings:setForgeWritesEnabled', next));
    },
    onRestartGameOnExitChange: (next) => {
      write('restartGameOnExit', (bridge) => bridge.invoke('settings:setRestartGameOnExit', next));
    },
    onMarketQuoteCurrencyChange: (next) => {
      write('marketQuoteCurrency', (bridge) => bridge.invoke('settings:setMarketQuoteCurrency', next));
    },
    onUsagePingEnabledChange: (next) => {
      write('usagePingEnabled', (bridge) => bridge.invoke('settings:setUsagePingEnabled', next));
    },
  };
}
