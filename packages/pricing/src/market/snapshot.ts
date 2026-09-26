import type { CatalogView } from './names.js';
import { indexEntries } from './reconcile.js';
import type { Anomaly, MarketEntry, MarketSnapshot } from './types.js';
import { MARKET_APP_ID, priceKey } from './types.js';

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
 * oscillates between full and partial from one pass to the next.
 *
 * A row this run DID reach keeps only what this run made of it. There is nothing to inherit: the
 * identity behind a row is a deterministic function of its market hash and the committed catalog,
 * so a run that enumerated a row knows exactly as much about it as any earlier run did. Filling a
 * gap from the previous file could therefore only keep a row keyed after its name stopped
 * generating, which is the one outcome name generation exists to prevent.
 */
export function mergeEntries(
  fresh: MarketEntry[],
  prior: MarketEntry[],
  enumerationComplete: boolean,
): MarketEntry[] {
  if (enumerationComplete) return fresh;

  const freshHashes = new Set(fresh.map((entry) => entry.hashName));
  const untouched = prior
    .filter((entry) => !freshHashes.has(entry.hashName))
    .map((entry) => withoutNativeQuote(entry));
  return [...fresh, ...untouched];
}

/**
 * Strips a native quote this run did not take itself.
 *
 * A carried-forward quote has no pass coming to replace it. The per-item quote pass is the first
 * thing a rate-limited run drops, and it is skipped outright when no native currency is
 * configured, so an inherited figure ages indefinitely behind a label that says it is the number
 * on the listing — and resolution prefers it over the freshly-converted price standing beside it,
 * so the two drift apart without bound. A row carrying only its converted price is dated by
 * `fetchedUtc`, which every published row already has.
 */
function withoutNativeQuote(entry: MarketEntry): MarketEntry {
  return { ...entry, lowestNative: {}, nativeQuotedUtc: null };
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
 * Catalog keys the previous snapshot could price, whose market row this one still carries and can
 * no longer price by that key.
 *
 * A row that has left the market takes its key with it, and that is the market talking. A row that
 * is still right there and has stopped answering to the key it answered to yesterday is this run
 * talking, and under name generation it can only be saying one thing: the market is spelling that
 * item's name differently now. The hash is what separates the two, and it can: Steam never reuses
 * one for a different item.
 *
 * A caller should treat a non-empty answer as a reason to publish nothing, on any run. Finishing
 * the walk buys no licence here — a completed walk that generated no name for a row it is still
 * carrying is exactly the failure this catches.
 */
export function catalogKeysLost(
  prior: MarketSnapshot | null,
  next: MarketSnapshot,
  catalog: CatalogView,
): string[] {
  if (prior == null) return [];
  const catalogKeys = new Set(
    catalog.defs.flatMap((def) => catalog.rarityIdxs.map((idx) => priceKey(def.defId, idx))),
  );
  const stillCarried = new Set(next.entries.map((entry) => entry.hashName));

  const lost: string[] = [];
  for (const [key, position] of Object.entries(prior.index)) {
    if (!catalogKeys.has(key) || next.index[key] != null) continue;
    const hashName = prior.entries[position]?.hashName;
    if (hashName != null && stillCarried.has(hashName)) lost.push(key);
  }
  return lost;
}

/**
 * Version 2 is still accepted because the published file only becomes version 3 on the next pass
 * that publishes it, and an app that shipped first would otherwise show no prices at all until
 * then.
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
