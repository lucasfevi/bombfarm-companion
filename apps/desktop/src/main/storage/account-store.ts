import type {
  AccountPayload,
  AccountSection,
  AccountStoreReason,
  AccountStoreStatus,
  RestoredAccount,
  StoredAccountFidelity,
  StoredSectionFidelity,
} from '@bombfarm/contracts';
import { decodeStoredSection, resolveAccountKey } from './account-rows.js';
import { ACCOUNT_SECTIONS } from './account-schema.js';
import type { LogPort, OpenResult } from './index.js';

export interface AccountStoreDeps {
  log?: LogPort;
}

export interface AccountStore {
  restore(expectedAccountId?: string | null): RestoredAccount;
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

  return {
    restore,
    close() {
      db?.close();
    },
  };
}
