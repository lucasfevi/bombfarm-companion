import type { ConsentDecision, ConsentRecord } from '@bombfarm/game-api';
import { CONSENT_TEXT_VERSION, initialConsent } from '@bombfarm/game-api';
import type { SqliteDb } from '../storage/index.js';

/**
 * Persists the consent record over the *existing* `account_meta` key/value table (design.md
 * §3.11) — no new table, no migration. One row, key `consent_v<version>`,
 * value = JSON of the record. Keying by `CONSENT_TEXT_VERSION` means a prior disclosure's grant
 * (or decline) row is left untouched under its own key rather than migrated: it stays as evidence
 * of what was previously agreed, and a read at the current version finds no row and falls back to
 * `initialConsent()`, so the current disclosure is shown and re-answered. Unreadable or malformed
 * rows fall back the same way — the modal re-asks rather than assuming a decision that was never
 * actually recorded.
 */
const CONSENT_META_KEY = `consent_v${String(CONSENT_TEXT_VERSION)}`;

const VALID_DECISIONS: readonly ConsentDecision[] = ['unasked', 'granted', 'declined', 'revoked'];

interface MetaRow {
  value: string;
}

function isConsentRecord(value: unknown): value is ConsentRecord {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  if (!VALID_DECISIONS.includes(record.decision as ConsentDecision)) return false;
  if (typeof record.textVersion !== 'number') return false;
  if (record.grantedAt !== undefined && typeof record.grantedAt !== 'string') return false;
  if (record.textLocale !== undefined && typeof record.textLocale !== 'string') return false;
  return true;
}

export interface ConsentStore {
  read(): ConsentRecord;
  write(record: ConsentRecord): void;
}

export function createConsentStore(db: SqliteDb | null): ConsentStore {
  return {
    read(): ConsentRecord {
      if (!db) {
        return initialConsent();
      }
      let row: MetaRow | undefined;
      try {
        row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(CONSENT_META_KEY) as
          | MetaRow
          | undefined;
      } catch {
        return initialConsent();
      }
      if (!row) {
        return initialConsent();
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(row.value);
      } catch {
        return initialConsent();
      }

      return isConsentRecord(parsed) ? parsed : initialConsent();
    },

    write(record: ConsentRecord): void {
      if (!db) {
        return;
      }
      try {
        db.prepare(
          'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
        ).run(CONSENT_META_KEY, JSON.stringify(record));
      } catch {
        // Best-effort: a write failure means the next read falls back to initialConsent(), the
        // safe direction (re-ask rather than silently assume a decision).
      }
    },
  };
}
