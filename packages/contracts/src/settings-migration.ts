import type { AppSettings } from './index.js';
import { DEFAULT_SETTINGS } from './index.js';
import { isAppLocale } from './locale.js';
import { isMarketQuoteCurrency, type MarketQuoteCurrency } from './market.js';

type BooleanFlag =
  | 'alwaysOnTopMain'
  | 'alwaysOnTopMini'
  | 'forgeWritesEnabled'
  | 'restartGameOnExit'
  | 'usagePingEnabled';

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
  if (schemaVersion !== 1 && schemaVersion !== 2 && schemaVersion !== 3 && schemaVersion !== 4) {
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
  const marketQuoteCurrency = readMarketQuoteCurrency(parsed);

  if (
    mainFlag === 'invalid' ||
    miniFlag === 'invalid' ||
    forgeWritesFlag === 'invalid' ||
    restartGameFlag === 'invalid' ||
    usagePingFlag === 'invalid' ||
    marketQuoteCurrency === 'invalid'
  ) {
    return null;
  }

  return {
    schemaVersion: 4,
    locale: parsed.locale,
    alwaysOnTopMain: mainFlag === 'missing' ? DEFAULT_SETTINGS.alwaysOnTopMain : mainFlag,
    alwaysOnTopMini: miniFlag === 'missing' ? DEFAULT_SETTINGS.alwaysOnTopMini : miniFlag,
    forgeWritesEnabled: forgeWritesFlag === 'missing' ? DEFAULT_SETTINGS.forgeWritesEnabled : forgeWritesFlag,
    restartGameOnExit: restartGameFlag === 'missing' ? DEFAULT_SETTINGS.restartGameOnExit : restartGameFlag,
    marketQuoteCurrency,
    usagePingEnabled: usagePingFlag === 'missing' ? DEFAULT_SETTINGS.usagePingEnabled : usagePingFlag,
  };
}
