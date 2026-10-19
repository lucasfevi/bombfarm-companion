import { readPremiumMeBody, readPremiumStatusBody, type PremiumMe, type PremiumStatus } from '@bombfarm/contracts';
import type { SqliteDb } from '../storage/index.js';

const CACHE_META_KEY = 'premium_cache_v1';

export interface PremiumCacheEntry {
  readonly fetchedAt: string;
  readonly status: PremiumStatus | null;
  readonly me: PremiumMe | null;
  readonly visible: boolean | null;
}

export interface PremiumCache {
  read(): PremiumCacheEntry | null;
  write(entry: PremiumCacheEntry): void;
  clear(): void;
}

interface MetaRow {
  value: string;
}

function statusToStored(status: PremiumStatus): unknown {
  return {
    active: status.active,
    kinds: status.kinds,
    until: status.until,
    states: {
      awaitingPayment: status.awaitingPaymentUntil === null ? null : { until: status.awaitingPaymentUntil },
      grace: status.graceUntil === null ? null : { until: status.graceUntil },
      cancellationScheduled: status.cancellationAt === null ? null : { at: status.cancellationAt },
      paymentFailed: status.paymentFailed,
      pendingFirstPayment: status.pendingFirstPayment,
      disputeHold: status.disputeHold,
    },
  };
}

function meToStored(me: PremiumMe): unknown {
  return {
    v: 1,
    signInMethods: me.methods,
    steamVerified: me.steamVerified,
    gameAccountLinked: me.gameAccountLinked,
    admitted: me.admitted,
  };
}

function parseEntry(json: string): PremiumCacheEntry | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const { fetchedAt, visible } = row;
  if (row['v'] !== 1 || typeof fetchedAt !== 'string' || Number.isNaN(Date.parse(fetchedAt))) return null;
  if (visible !== null && typeof visible !== 'boolean') return null;
  const status = row['status'] === null ? null : readPremiumStatusBody(row['status']);
  const me = row['me'] === null ? null : readPremiumMeBody(row['me']);
  if ((row['status'] !== null && status === null) || (row['me'] !== null && me === null)) return null;
  return { fetchedAt, status, me, visible };
}

function deleteRow(db: SqliteDb | null): void {
  if (!db) return;
  try {
    db.prepare('DELETE FROM account_meta WHERE key = ?').run(CACHE_META_KEY);
  } catch {
    // A row that cannot be deleted fails validation again, and is dropped again, on the next read.
  }
}

export function createPremiumCache(db: SqliteDb | null): PremiumCache {
  let memory: PremiumCacheEntry | null = null;

  return {
    read() {
      if (memory !== null) return memory;
      if (!db) return null;
      let stored: string | undefined;
      try {
        const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(CACHE_META_KEY) as
          | MetaRow
          | undefined;
        stored = row?.value;
      } catch {
        return null;
      }
      if (stored === undefined) return null;
      const entry = parseEntry(stored);
      if (entry === null) {
        deleteRow(db);
        return null;
      }
      memory = entry;
      return entry;
    },
    write(entry) {
      memory = entry;
      if (!db) return;
      const value = JSON.stringify({
        v: 1,
        fetchedAt: entry.fetchedAt,
        status: entry.status === null ? null : statusToStored(entry.status),
        me: entry.me === null ? null : meToStored(entry.me),
        visible: entry.visible,
      });
      try {
        db.prepare(
          'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
        ).run(CACHE_META_KEY, value);
      } catch {
        // The entry stays in memory for this run; the next good fetch writes it again.
      }
    },
    clear() {
      memory = null;
      deleteRow(db);
    },
  };
}
