import type { AppSettings } from './index.js';
import { DEFAULT_SETTINGS } from './index.js';
import { isAppLocale } from './locale.js';
import { isMarketQuoteCurrency, type MarketQuoteCurrency } from './market.js';

type BooleanFlag =
  | 'alwaysOnTopMain'
  | 'alwaysOnTopMini'
  | 'forgeWritesEnabled'
  | 'restartGameOnExit'
  | 'startWithWindows'
  | 'usagePingEnabled';

/** The newest stored shape this build writes. Held here, not read off `DEFAULT_SETTINGS`, because
 *  `index.ts` re-exports this module before it defines `DEFAULT_SETTINGS` — a top-level read of it
 *  would hit the temporal dead zone. The `satisfies` ties it to `AppSettings` at compile time, and
 *  the migration test ties it to `DEFAULT_SETTINGS.schemaVersion` at run time. */
const CURRENT_SCHEMA_VERSION = 5 satisfies AppSettings['schemaVersion'];

/** Every stored version this build still reads, `1 … current`. Built from a range so a version
 *  bump extends it without a second edit. */
export const SETTINGS_SCHEMA_VERSIONS: readonly number[] = Array.from(
  { length: CURRENT_SCHEMA_VERSION },
  (_, index) => index + 1,
);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readBooleanFlag(record: Record<string, unknown>, key: BooleanFlag): boolean | 'missing' | 'invalid' {
  if (!(key in record)) {
    return 'missing';
  }
  const value = record[key];
  if (typeof value === 'boolean') {
    return value;
  }
  return 'invalid';
}

/** A code this build no longer offers is not malformed storage: the rest of the row still holds,
 *  and only the currency falls back. Anything that is not a string at all is. */
function readMarketQuoteCurrency(record: Record<string, unknown>): MarketQuoteCurrency | 'invalid' {
  const value = record.marketQuoteCurrency;
  if (value === undefined) {
    return DEFAULT_SETTINGS.marketQuoteCurrency;
  }
  if (typeof value !== 'string') {
    return 'invalid';
  }
  return isMarketQuoteCurrency(value) ? value : DEFAULT_SETTINGS.marketQuoteCurrency;
}

export function migrateStoredSettings(parsed: unknown): AppSettings | null {
  if (!isPlainObject(parsed)) {
    return null;
  }

  const schemaVersion = parsed.schemaVersion;
  if (typeof schemaVersion !== 'number' || !SETTINGS_SCHEMA_VERSIONS.includes(schemaVersion)) {
    return null;
  }

  if (!isAppLocale(parsed.locale)) {
    return null;
  }

  if (schemaVersion === 1) {
    return {
      ...DEFAULT_SETTINGS,
      locale: parsed.locale,
    };
  }

  const mainFlag = readBooleanFlag(parsed, 'alwaysOnTopMain');
  const miniFlag = readBooleanFlag(parsed, 'alwaysOnTopMini');
  const forgeWritesFlag = readBooleanFlag(parsed, 'forgeWritesEnabled');
  const restartGameFlag = readBooleanFlag(parsed, 'restartGameOnExit');
  const usagePingFlag = readBooleanFlag(parsed, 'usagePingEnabled');
  const startWithWindowsFlag = readBooleanFlag(parsed, 'startWithWindows');
  const marketQuoteCurrency = readMarketQuoteCurrency(parsed);

  if (
    mainFlag === 'invalid' ||
    miniFlag === 'invalid' ||
    forgeWritesFlag === 'invalid' ||
    restartGameFlag === 'invalid' ||
    usagePingFlag === 'invalid' ||
    startWithWindowsFlag === 'invalid' ||
    marketQuoteCurrency === 'invalid'
  ) {
    return null;
  }

  return {
    schemaVersion: DEFAULT_SETTINGS.schemaVersion,
    locale: parsed.locale,
    alwaysOnTopMain: mainFlag === 'missing' ? DEFAULT_SETTINGS.alwaysOnTopMain : mainFlag,
    alwaysOnTopMini: miniFlag === 'missing' ? DEFAULT_SETTINGS.alwaysOnTopMini : miniFlag,
    forgeWritesEnabled: forgeWritesFlag === 'missing' ? DEFAULT_SETTINGS.forgeWritesEnabled : forgeWritesFlag,
    restartGameOnExit: restartGameFlag === 'missing' ? DEFAULT_SETTINGS.restartGameOnExit : restartGameFlag,
    marketQuoteCurrency,
    usagePingEnabled: usagePingFlag === 'missing' ? DEFAULT_SETTINGS.usagePingEnabled : usagePingFlag,
    startWithWindows: startWithWindowsFlag === 'missing' ? DEFAULT_SETTINGS.startWithWindows : startWithWindowsFlag,
  };
}
