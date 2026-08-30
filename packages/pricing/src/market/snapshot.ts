import { indexEntries, type CatalogView } from './reconcile.js';
import type { Anomaly, MarketEntry, MarketSnapshot } from './types.js';
import { MARKET_APP_ID } from './types.js';

export interface SnapshotParts {
  entries: MarketEntry[];
  prior: MarketSnapshot | null;
  catalog: CatalogView;
  fx: Record<string, number>;
  /** Currencies the quote pass asked Steam for, whether or not any of them came back. */
  nativeCurrencies?: string[];
  anomalies: Anomaly[];
  searchCalls: number;
  /** True when the flat enumeration finished, making this run's row set authoritative. */
  enumerationComplete: boolean;
  now: () => number;
  appId?: number;
}

/**
 * Merge this run's rows with the previous snapshot's.
 *
 * A completed enumeration walked the whole market, so its row set is the truth and anything
 * missing from it has genuinely been delisted. A run cut short by Steam's IP quota knows nothing
 * about the rows it never reached, so it keeps them rather than publishing a snapshot that
 * oscillates between full and partial every six hours.
 */
export function mergeEntries(
  fresh: MarketEntry[],
  prior: MarketEntry[],
  enumerationComplete: boolean,
): MarketEntry[] {
  const priorByHash = new Map(prior.map((entry) => [entry.hashName, entry]));
  const kept = fresh.map((entry) => {
    const previous = priorByHash.get(entry.hashName);
    return previous == null ? entry : withPriorIdentity(entry, previous);
  });
  if (enumerationComplete) return kept;

  const freshHashes = new Set(fresh.map((entry) => entry.hashName));
  return [...kept, ...prior.filter((entry) => !freshHashes.has(entry.hashName))];
}

/**
 * Fill in only the identity a run failed to re-establish. A rate-limited run can enumerate a row
 * and then stop before the tag passes that would say what it is, which would drop it out of the
 * index — an item that had a price yesterday would show none today. Prices are never inherited
 * this way: a null `lowestUsd` is the meaningful statement that nothing is listed right now.
 */
function withPriorIdentity(fresh: MarketEntry, prior: MarketEntry): MarketEntry {
  const defId = fresh.defId ?? prior.defId;
  const category = fresh.category ?? prior.category;
  return {
    ...fresh,
    ...inheritedNativeQuote(fresh, prior),
    key: fresh.category == null && category != null ? prior.key : fresh.key,
    defId,
    kind: fresh.kind ?? prior.kind,
    category,
    set: fresh.set ?? prior.set,
    slot: fresh.slot ?? prior.slot,
    rarityIdx: fresh.rarityIdx ?? prior.rarityIdx,
    level: fresh.level ?? prior.level,
    act: fresh.act ?? prior.act,
  };
}

/**
 * Carries a previous run's native quotes forward when this run did not take its own, which is
 * what a rate-limited pass leaves behind: the enumeration lands, the per-item quotes do not.
 *
 * Only while the USD price is unchanged. A native quote is a price, not an identity, and it
 * describes the order book at the moment it was read — once the book has visibly moved the old
 * quote is known to be wrong, and falling back to the freshly-converted figure is the smaller
 * error. Verified against a real move: `Gold Ring Lv 20 (Rare)` went $2.80 -> $1.10 within one
 * six-hour window, which an inherited R$ 14,46 would have gone on reporting against R$ 5,75.
 */
function inheritedNativeQuote(
  fresh: MarketEntry,
  prior: MarketEntry,
): Pick<MarketEntry, 'lowestNative' | 'nativeQuotedUtc'> {
  const tookOwnQuote = Object.keys(fresh.lowestNative).length > 0;
  if (tookOwnQuote) return { lowestNative: fresh.lowestNative, nativeQuotedUtc: fresh.nativeQuotedUtc };

  const priceMoved = fresh.lowestUsd !== prior.lowestUsd;
  if (priceMoved) return { lowestNative: {}, nativeQuotedUtc: null };

  return { lowestNative: prior.lowestNative, nativeQuotedUtc: prior.nativeQuotedUtc };
}

export function buildSnapshot(parts: SnapshotParts): MarketSnapshot {
  const generatedUtc = new Date(parts.now()).toISOString();
  const entries = mergeEntries(
    parts.entries,
    parts.prior?.entries ?? [],
    parts.enumerationComplete,
  );
  const indexed = indexEntries(entries, parts.catalog);

  return {
    schemaVersion: 3,
    generatedUtc,
    appId: parts.appId ?? MARKET_APP_ID,
    baseCurrency: 'USD',
    nativeCurrencies: parts.nativeCurrencies ?? [],
    fx: parts.fx,
    entries,
    index: indexed.index,
    alternates: indexed.alternates,
    unlisted: indexed.unlisted,
    anomalies: [...parts.anomalies, ...indexed.anomalies],
    coverage: { ...indexed.coverage, searchCalls: parts.searchCalls },
  };
}

/**
 * Version 2 is still accepted because the published file only becomes version 3 on the job's next
 * six-hourly run, and an app that shipped first would otherwise show no prices at all until then.
 * A version 2 entry simply carries no native quotes, which `resolveKey` already reads as
 * "convert from USD" — the correct answer for a snapshot taken before any currency was quoted.
 */
const READABLE_SCHEMA_VERSIONS = new Set([2, 3]);

/**
 * Validate a published snapshot and bring it up to the current shape.
 *
 * This is the one place a version 2 payload becomes a version 3 one, so nothing downstream has to
 * defend against fields an older file simply does not carry. It matters past the rollout window:
 * a client caches the file it downloaded, so a version 2 snapshot can be read back from disk long
 * after the job started publishing version 3.
 */
export function readMarketSnapshot(value: unknown): MarketSnapshot | null {
  if (!isMarketSnapshot(value)) return null;

  // The guard says version 3, which is the shape callers get back — not the shape on the wire.
  // A version 2 payload passes it while genuinely lacking these fields, so they are read through
  // a type that admits their absence rather than one that asserts it away.
  const raw = value as Omit<MarketSnapshot, 'nativeCurrencies' | 'entries'> &
    Partial<Pick<MarketSnapshot, 'nativeCurrencies'>> & {
      entries: (Omit<MarketEntry, 'lowestNative' | 'nativeQuotedUtc'> &
        Partial<Pick<MarketEntry, 'lowestNative' | 'nativeQuotedUtc'>>)[];
    };

  return {
    ...raw,
    schemaVersion: 3,
    nativeCurrencies: raw.nativeCurrencies ?? [],
    entries: raw.entries.map((entry) => ({
      ...entry,
      lowestNative: entry.lowestNative ?? {},
      nativeQuotedUtc: entry.nativeQuotedUtc ?? null,
    })),
  };
}

export function isMarketSnapshot(value: unknown): value is MarketSnapshot {
  if (value == null || typeof value !== 'object') return false;
  const snapshot = value as Record<string, unknown>;
  return (
    READABLE_SCHEMA_VERSIONS.has(snapshot.schemaVersion as number) &&
    typeof snapshot.generatedUtc === 'string' &&
    Array.isArray(snapshot.entries) &&
    typeof snapshot.index === 'object' &&
    snapshot.index != null &&
    typeof snapshot.fx === 'object' &&
    snapshot.fx != null
  );
}
