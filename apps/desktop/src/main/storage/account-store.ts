import type {
  AccountPayload,
  AccountSection,
  AccountStoreReason,
  AccountStoreStatus,
  AccountView,
  RestoredAccount,
  StoredAccountFidelity,
  StoredSectionFidelity,
} from '@bombfarm/contracts';
import { decodeStoredSection, resolveAccountKey } from './account-rows.js';
import { ACCOUNT_SECTIONS } from './account-schema.js';
import type { LogPort, OpenResult } from './index.js';
import { mergeStoredIntoLive } from './merge-account.js';

export interface AccountStoreDeps {
  log?: LogPort;
}

export interface PersistOpts {
  accountId?: string | null;
}

export interface PersistResult {
  written: readonly AccountSection[];
}

export interface CommitOpts {
  accountId?: string | null;
  gameRunning: boolean;
}

export interface AccountStore {
  restore(expectedAccountId?: string | null): RestoredAccount;
  persist(payload: AccountPayload, opts?: PersistOpts): PersistResult;
  /** `persist(live)` then `restore()` then `mergeStoredIntoLive` — the single entry point a
   * producer calls each poll. */
  commit(live: AccountPayload, opts: CommitOpts): AccountView;
  close(): void;
}

interface SectionRow {
  body: string;
  captured_at: string;
}

interface AccountMetaRow {
  value: string;
}

const NOOP_LOG: LogPort = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function emptyStoredFidelity(): StoredAccountFidelity {
  const result = {} as Record<AccountSection, StoredSectionFidelity>;
  for (const section of ACCOUNT_SECTIONS) {
    result[section] = { status: 'missing' };
  }
  return result;
}

function unavailableRestore(status: AccountStoreStatus, reason: AccountStoreReason | null): RestoredAccount {
  return {
    status,
    reason,
    gameRunning: false,
    payload: { fidelity: emptyStoredFidelity() },
  };
}

/**
 * The whole feature over the `SqliteDb` port (design.md §5). `open` is the result of
 * `openAccountDatabase` — its own status/reason propagate untouched when the store cannot
 * read anything (schema too new, no binding, not writable). `restore()` never constructs a
 * `resolved` section — every section it returns is built from row presence alone (AD-025).
 */
export function createAccountStore(open: OpenResult, deps: AccountStoreDeps = {}): AccountStore {
  const log = deps.log ?? NOOP_LOG;
  const db = open.db;

  function getBoundAccountId(): string | null {
    if (!db) return null;
    const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get('account_id') as
      | AccountMetaRow
      | undefined;
    return row ? row.value : null;
  }

  function readSectionRow(key: string, section: AccountSection): SectionRow | undefined {
    if (!db) return undefined;
    return db
      .prepare('SELECT body, captured_at FROM account_section WHERE account_key = ? AND section = ?')
      .get(key, section) as SectionRow | undefined;
  }

  function restore(expectedAccountId: string | null = null): RestoredAccount {
    if (open.status !== 'ok' || !db) {
      return unavailableRestore(open.status, open.reason);
    }

    const bound = getBoundAccountId();
    const { key, mismatch } = resolveAccountKey(bound, expectedAccountId);

    if (mismatch) {
      log.warn({ scope: 'storage', event: 'account.mismatch', bound, incoming: expectedAccountId });
      return unavailableRestore('unavailable', 'account_mismatch');
    }

    const fidelity = {} as Record<AccountSection, StoredSectionFidelity>;
    const sectionBodies: Partial<Record<AccountSection, unknown>> = {};
    let anyRowPresent = false;

    for (const section of ACCOUNT_SECTIONS) {
      const row = readSectionRow(key, section);
      if (!row) {
        fidelity[section] = { status: 'missing' };
        continue;
      }

      anyRowPresent = true;
      const decoded = decodeStoredSection(section, row.body);
      if (!decoded.ok) {
        log.warn({ scope: 'storage', event: 'account.row_discarded', section, reason: decoded.reason });
        fidelity[section] = { status: 'missing' };
        continue;
      }

      fidelity[section] = { status: 'stale', capturedAt: row.captured_at };
      sectionBodies[section] = decoded.body;
    }

    if (!anyRowPresent) {
      return unavailableRestore('unavailable', 'empty');
    }

    return {
      status: 'ok',
      reason: null,
      gameRunning: false,
      payload: { ...sectionBodies, fidelity } as AccountPayload & {
        fidelity: StoredAccountFidelity;
      },
    };
  }

  function setBoundAccountId(key: string): void {
    if (!db) return;
    db.prepare(
      'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
    ).run('account_id', key);
  }

  /**
   * Writes section `S` iff `payload.fidelity?.[S]?.status === 'resolved'` and `payload[S]`
   * is present — an allow-list of exactly one status (design TD-7), so a future/unknown
   * status (e.g. `degraded`, `AD-023`) is never written by default. `capturedAt` is stored
   * verbatim. All writes for one poll run inside one transaction; a throw mid-poll rolls
   * back the whole poll, leaving every previously stored section untouched.
   */
  function persist(payload: AccountPayload, opts: PersistOpts = {}): PersistResult {
    if (!db) {
      return { written: [] };
    }

    const fidelity = payload.fidelity;
    if (!fidelity) {
      log.warn({ scope: 'storage', event: 'account.no_fidelity' });
      return { written: [] };
    }

    const untypedPayload = payload as unknown as Record<string, unknown>;
    const toWrite: { section: AccountSection; body: unknown; capturedAt: string }[] = [];
    for (const section of ACCOUNT_SECTIONS) {
      const sectionFidelity = fidelity[section];
      const body = untypedPayload[section];
      if (sectionFidelity.status === 'resolved' && body !== undefined) {
        toWrite.push({ section, body, capturedAt: sectionFidelity.capturedAt });
      }
    }

    if (toWrite.length === 0) {
      return { written: [] };
    }

    const bound = getBoundAccountId();
    const resolved = resolveAccountKey(bound, opts.accountId ?? null);

    try {
      db.exec('BEGIN');
      if (resolved.rebind) {
        setBoundAccountId(resolved.key);
      }
      for (const item of toWrite) {
        db.prepare(
          'INSERT INTO account_section (account_key, section, body, captured_at) VALUES (?, ?, ?, ?) ' +
            'ON CONFLICT(account_key, section) DO UPDATE SET body = excluded.body, captured_at = excluded.captured_at',
        ).run(resolved.key, item.section, JSON.stringify(item.body), item.capturedAt);
      }
      db.exec('COMMIT');
    } catch (err) {
      try {
        db.exec('ROLLBACK');
      } catch {
        // best-effort rollback of an already-broken transaction
      }
      log.error({ scope: 'storage', event: 'account.persist_failed', error: String(err) });
      return { written: [] };
    }

    return { written: toWrite.map((item) => item.section) };
  }

  function commit(live: AccountPayload, opts: CommitOpts): AccountView {
    const accountId = opts.accountId ?? null;
    persist(live, { accountId });
    const restored = restore(accountId);
    return mergeStoredIntoLive(live, restored, { gameRunning: opts.gameRunning, binding: open.binding });
  }

  return {
    restore,
    persist,
    commit,
    close() {
      db?.close();
    },
  };
}
