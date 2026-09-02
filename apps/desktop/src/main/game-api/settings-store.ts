import type { AppSettings, SettingsWriteResult } from '@bombfarm/contracts';
import { migrateStoredSettings } from '@bombfarm/contracts';
import type { SqliteDb } from '../storage/index.js';

/**
 * Persists the chosen language over the *existing* `account_meta` key/value table,
 * a structural copy of `consent-store.ts` — same table, same `SELECT`/`INSERT … ON CONFLICT DO
 * UPDATE` statements, same `db: SqliteDb | null` first-class "never opened" state. No new table,
 * no migration, `account-schema.ts`'s `SCHEMA_VERSION` does not move.
 *
 * The one place `consent-store.ts`'s template is DELIBERATELY not copied: consent's `write()`
 * swallows every failure (a comment there explains why re-asking is always safe). Settings has no
 * safe re-ask — the unwritable-settings rule requires the app to apply the language for the session and *surface* that
 * it will not survive a restart — so `write()` here reports `{ persisted, reason }` instead.
 */
const SETTINGS_META_KEY = 'settings_v1';

interface MetaRow {
  value: string;
}

export interface SettingsStore {
  /** `null` means "nothing stored" — never a default. Collapsing "the player chose English" and
   *  "nothing is stored" would make the survives-restart guarantee unimplementable and the bug invisible outside a PT-BR
   *  machine. */
  read(): AppSettings | null;
  /** Reports success; does not swallow (see this file's own doc comment). `settings` in the
   *  result is always the value passed in, so "applies even when the write fails" is
   *  structural — there is no branch that can return anything else. */
  write(settings: AppSettings): SettingsWriteResult;
}

export function createSettingsStore(db: SqliteDb | null): SettingsStore {
  return {
    read(): AppSettings | null {
      if (!db) {
        return null;
      }
      let row: MetaRow | undefined;
      try {
        row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(SETTINGS_META_KEY) as
          | MetaRow
          | undefined;
      } catch {
        return null;
      }
      if (!row) {
        return null;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(row.value);
      } catch {
        return null;
      }

      return migrateStoredSettings(parsed);
    },

    write(settings: AppSettings): SettingsWriteResult {
      if (!db) {
        return { settings, persisted: false, reason: 'no_store' };
      }
      try {
        db.prepare(
          'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
        ).run(SETTINGS_META_KEY, JSON.stringify(settings));
      } catch {
        return { settings, persisted: false, reason: 'not_writable' };
      }
      return { settings, persisted: true, reason: null };
    },
  };
}
