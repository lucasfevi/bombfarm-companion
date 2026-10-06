import { EMPTY_COLLECTIONS_VIEW, type AccountSource, type CollectionsSnapshot, type CollectionsView } from '@bombfarm/contracts';
import { isCollectionsSnapshot } from '@bombfarm/game-api';
import type { LogPort, SqliteDb } from '../storage/index.js';

/**
 * The last good Collections read, over the same database the account store opens — the PVP history
 * borrows that handle the same way. The table is additive (`CREATE TABLE IF NOT EXISTS` beside the
 * account tables), so `SCHEMA_VERSION` does not move: an older build simply never reads it.
 *
 * One row per account, newest wins, with no history. The row is keyed by the account the session
 * token names: the PVP standing rows carry no account, but a book is permanent and account-wide,
 * so showing one account's book under another would be a wrong answer rather than a stale one.
 * A read the app asked for is stored under the account it asked as, not the one bound by the time
 * the body lands; a body the tap saw carries no request, so it is stored under the account bound
 * as it passes. With no account to name (consent off, token unreadable) the key is the empty
 * string. When the account source is the fixture, every read and write uses one reserved key that
 * no account id can equal, so pointing a fixture run at a real profile never touches a real row.
 */
export const INIT_COLLECTIONS_SQL = `
CREATE TABLE IF NOT EXISTS collections_state (
  account_id  TEXT PRIMARY KEY,
  captured_at TEXT NOT NULL,
  body        TEXT NOT NULL
);
`;

const NO_ACCOUNT = '';
const FIXTURE_KEY = '~fixture';

const READ_SQL = 'SELECT captured_at, body FROM collections_state WHERE account_id = ?';

const WRITE_SQL = `
INSERT INTO collections_state (account_id, captured_at, body) VALUES (?, ?, ?)
ON CONFLICT(account_id) DO UPDATE SET captured_at = excluded.captured_at, body = excluded.body
`;

/** `recorded` means the row is the one `view()` answers from now, so the renderer should hear of
 *  it; `recorded_for_other_account` means the account that was asked is no longer the bound one,
 *  so the row is kept for when it returns and nobody is told. */
export type CollectionsRecordOutcome = 'recorded' | 'recorded_for_other_account' | 'failed';

export interface CollectionsStore {
  /** Replaces the snapshot held for `accountId` (the bound account when omitted), dating it. */
  record(
    snapshot: CollectionsSnapshot,
    opts: { readonly capturedAt: string; readonly accountId?: string },
  ): CollectionsRecordOutcome;
  /** What is held for the account the app is bound to right now; empty when nothing is, or when the
   *  row no longer reads as the contract's shape. */
  view(): CollectionsView;
}

export interface CollectionsStoreDeps {
  readonly db: SqliteDb | null;
  /** Resolved on every call: the account is whoever the session token names at that moment. */
  readonly accountId: () => string | null;
  readonly accountSource: () => AccountSource;
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

  function boundKey(): string {
    return deps.accountSource() === 'fixture' ? FIXTURE_KEY : keyOf(deps.accountId());
  }

  return {
    record(snapshot, { capturedAt, accountId }) {
      if (!db) return 'failed';
      try {
        const bound = boundKey();
        const key = bound === FIXTURE_KEY || accountId === undefined ? bound : accountId;
        db.prepare(WRITE_SQL).run(key, capturedAt, JSON.stringify(snapshot));
        return key === bound ? 'recorded' : 'recorded_for_other_account';
      } catch (err) {
        log.error({ scope: 'collections', event: 'store.record_failed', error: String(err) });
        return 'failed';
      }
    },

    view() {
      if (!db) return EMPTY_COLLECTIONS_VIEW;
      try {
        const row = db.prepare(READ_SQL).get(boundKey()) as StoredRow | undefined;
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
