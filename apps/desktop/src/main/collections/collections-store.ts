import { EMPTY_COLLECTIONS_VIEW, type CollectionsSnapshot, type CollectionsView } from '@bombfarm/contracts';
import type { LogPort, SqliteDb } from '../storage/index.js';
import { isCollectionsSnapshot } from './snapshot-shape.js';

/**
 * The last good Collections read, over the same database the account store opens — the PVP history
 * borrows that handle the same way. The table is additive (`CREATE TABLE IF NOT EXISTS` beside the
 * account tables), so `SCHEMA_VERSION` does not move: an older build simply never reads it.
 *
 * One row per account, newest wins, with no history. The row is bound to the account the session
 * token names: the PVP standing rows carry no account, but a book is permanent and account-wide,
 * so showing one account's book under another would be a wrong answer rather than a stale one.
 * With no account to name (consent off, token unreadable) the row is keyed by the empty string and
 * only ever answers that same state.
 */
export const INIT_COLLECTIONS_SQL = `
CREATE TABLE IF NOT EXISTS collections_state (
  account_id  TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  body        TEXT NOT NULL
);
`;

const NO_ACCOUNT = '';

const READ_SQL = 'SELECT captured_at, body FROM collections_state WHERE account_id = ?';

const WRITE_SQL = `
INSERT INTO collections_state (account_id, captured_at, body) VALUES (?, ?, ?)
ON CONFLICT(account_id) DO UPDATE SET captured_at = excluded.captured_at, body = excluded.body
`;

export interface CollectionsStore {
  /** Replaces the held snapshot, dating it; `false` only with no store behind it or on a failed write. */
  record(snapshot: CollectionsSnapshot, opts: { readonly capturedAt: string }): boolean;
  /** What is held for the account the app is bound to right now; empty when nothing is, or when the
   *  row no longer reads as the contract's shape. */
  view(): CollectionsView;
}

export interface CollectionsStoreDeps {
  readonly db: SqliteDb | null;
  /** Resolved on every call: the account is whoever the session token names at that moment. */
  readonly accountId: () => string | null;
  readonly log?: LogPort;
}

interface StoredRow {
  captured_at: string;
  body: string;
}

const NOOP_LOG: LogPort = { info: () => undefined, warn: () => undefined, error: () => undefined };

function keyOf(accountId: string | null): string {
  return accountId ?? NO_ACCOUNT;
}

export function createCollectionsStore(deps: CollectionsStoreDeps): CollectionsStore {
  const { db } = deps;
  const log = deps.log ?? NOOP_LOG;
  if (db) {
    try {
      db.exec(INIT_COLLECTIONS_SQL);
    } catch (err) {
      log.error({ scope: 'collections', event: 'store.init_failed', error: String(err) });
    }
  }

  return {
    record(snapshot, { capturedAt }) {
      if (!db) return false;
      try {
        db.prepare(WRITE_SQL).run(keyOf(deps.accountId()), capturedAt, JSON.stringify(snapshot));
        return true;
      } catch (err) {
        log.error({ scope: 'collections', event: 'store.record_failed', error: String(err) });
        return false;
      }
    },

    view() {
      if (!db) return EMPTY_COLLECTIONS_VIEW;
      try {
        const row = db.prepare(READ_SQL).get(keyOf(deps.accountId())) as StoredRow | undefined;
        if (!row) return EMPTY_COLLECTIONS_VIEW;
        const snapshot: unknown = JSON.parse(row.body);
        if (!isCollectionsSnapshot(snapshot)) {
          log.warn({ scope: 'collections', event: 'store.row_unreadable' });
          return EMPTY_COLLECTIONS_VIEW;
        }
        return { snapshot, capturedAt: row.captured_at };
      } catch (err) {
        log.warn({ scope: 'collections', event: 'store.row_unreadable', error: String(err) });
        return EMPTY_COLLECTIONS_VIEW;
      }
    },
  };
}
