import { canonicalStringify } from '@bombfarm/contracts';

const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_COUNT_FLUSH_INTERVAL_MS = 60_000;

export const VOLATILE_FIELDS = ['heroId', 'hero', 'at', 'timestamp', 'ts'] as const;

const VOLATILE_FIELD_SET = new Set<string>(VOLATILE_FIELDS);

export interface EventDeduperDeps {
  emit(record: Record<string, unknown>): void;
  now: () => number;
  maxEntries?: number;
  countFlushIntervalMs?: number;
}

export interface EventDeduper {
  report(record: Record<string, unknown>): void;
  flush(): void;
  size(): number;
}

interface DedupEntry {
  firstRecord: Record<string, unknown>;
  suppressedCount: number;
}

function dedupKey(record: Record<string, unknown>): string {
  const identifying: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!VOLATILE_FIELD_SET.has(key)) identifying[key] = value;
  }
  return canonicalStringify(identifying);
}

export function createEventDeduper(deps: EventDeduperDeps): EventDeduper {
  const maxEntries = deps.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const countFlushIntervalMs = deps.countFlushIntervalMs ?? DEFAULT_COUNT_FLUSH_INTERVAL_MS;

  const entries = new Map<string, DedupEntry>();
  let lastFlushedAt = deps.now();
  let evictedTotal = 0;
  let evictionAnnounced = false;

  function touch(key: string, entry: DedupEntry): void {
    entries.delete(key);
    entries.set(key, entry);
  }

  function emitSummary(entry: DedupEntry): void {
    if (entry.suppressedCount === 0) return;
    const summary: Record<string, unknown> = { ...entry.firstRecord, suppressedCount: entry.suppressedCount };
    if (evictedTotal > 0) summary.evictedTotal = evictedTotal;
    deps.emit(summary);
    entry.suppressedCount = 0;
  }

  function evictLeastRecentlySeen(): void {
    if (entries.size <= maxEntries) return;

    const oldestKey = entries.keys().next().value;
    if (oldestKey === undefined) return;
    const evicted = entries.get(oldestKey);
    entries.delete(oldestKey);
    evictedTotal += 1;
    // Dropping the entry would drop the occurrences counted against it since the last flush, and
    // an undercount is indistinguishable from a quieter problem.
    if (evicted) emitSummary(evicted);

    if (!evictionAnnounced) {
      evictionAnnounced = true;
      deps.emit({
        scope: 'boundary-log',
        event: 'dedup.entry_evicted',
        evictedTotal,
      });
    }
  }

  function flush(): void {
    lastFlushedAt = deps.now();
    for (const entry of entries.values()) emitSummary(entry);
  }

  function maybeFlushOnInterval(): void {
    if (deps.now() - lastFlushedAt < countFlushIntervalMs) return;
    flush();
  }

  function report(record: Record<string, unknown>): void {
    const key = dedupKey(record);
    const existing = entries.get(key);

    if (existing === undefined) {
      entries.set(key, { firstRecord: record, suppressedCount: 0 });
      evictLeastRecentlySeen();
      deps.emit(record);
      maybeFlushOnInterval();
      return;
    }

    existing.suppressedCount += 1;
    touch(key, existing);
    maybeFlushOnInterval();
  }

  function size(): number {
    return entries.size;
  }

  return { report, flush, size };
}
