import { indexEntries, type CatalogView } from './reconcile.js';
import type { Anomaly, MarketEntry, MarketSnapshot } from './types.js';
import { MARKET_APP_ID } from './types.js';

export interface SnapshotParts {
  entries: MarketEntry[];
  prior: MarketSnapshot | null;
  catalog: CatalogView;
  fx: Record<string, number>;
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

export function buildSnapshot(parts: SnapshotParts): MarketSnapshot {
  const generatedUtc = new Date(parts.now()).toISOString();
  const entries = mergeEntries(
    parts.entries,
    parts.prior?.entries ?? [],
    parts.enumerationComplete,
  );
  const indexed = indexEntries(entries, parts.catalog);

  return {
    schemaVersion: 2,
    generatedUtc,
    appId: parts.appId ?? MARKET_APP_ID,
    baseCurrency: 'USD',
    fx: parts.fx,
    entries,
    index: indexed.index,
    alternates: indexed.alternates,
    unlisted: indexed.unlisted,
    anomalies: [...parts.anomalies, ...indexed.anomalies],
    coverage: { ...indexed.coverage, searchCalls: parts.searchCalls },
  };
}

export function isMarketSnapshot(value: unknown): value is MarketSnapshot {
  if (value == null || typeof value !== 'object') return false;
  const snapshot = value as Record<string, unknown>;
  return (
    snapshot.schemaVersion === 2 &&
    typeof snapshot.generatedUtc === 'string' &&
    Array.isArray(snapshot.entries) &&
    typeof snapshot.index === 'object' &&
    snapshot.index != null &&
    typeof snapshot.fx === 'object' &&
    snapshot.fx != null
  );
}
