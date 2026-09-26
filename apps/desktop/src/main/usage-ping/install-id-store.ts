import { randomUUID } from 'node:crypto';
import type { SqliteDb } from '../storage/index.js';

const INSTALL_ID_META_KEY = 'usage_install_id_v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface MetaRow {
  value: string;
}

export interface InstallIdStore {
  /** The install's id, created on first use. Survives restarts through `account_meta`; when the
   *  table cannot be read or written it still returns one id for the rest of the session. */
  ensure(): string;
  /** Forgets the id everywhere, so turning the ping back on starts an unlinked history. */
  clear(): void;
}

function readStored(db: SqliteDb | null): string | null {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(INSTALL_ID_META_KEY) as
      | MetaRow
      | undefined;
    return row && UUID.test(row.value) ? row.value.toLowerCase() : null;
  } catch {
    return null;
  }
}

function writeStored(db: SqliteDb | null, id: string): void {
  if (!db) return;
  try {
    db.prepare(
      'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
    ).run(INSTALL_ID_META_KEY, id);
  } catch {
    // The session keeps its in-memory id; the next start simply mints another.
  }
}

export function createInstallIdStore(db: SqliteDb | null, newId: () => string = randomUUID): InstallIdStore {
  let current: string | null = null;

  return {
    ensure() {
      if (current !== null) return current;
      current = readStored(db);
      if (current !== null) return current;
      current = newId();
      writeStored(db, current);
      return current;
    },
    clear() {
      current = null;
      if (!db) return;
      try {
        db.prepare('DELETE FROM account_meta WHERE key = ?').run(INSTALL_ID_META_KEY);
      } catch {
        // Nothing to do: a row that cannot be deleted is re-read on the next opt-in, which the
        // player can undo by opting out again.
      }
    },
  };
}
