import type { SqliteDb } from '../storage/index.js';

const SESSION_META_KEY = 'premium_session_v1';

export interface SecretBox {
  isAvailable(): boolean;
  encrypt(plain: string): Buffer;
  decrypt(cipher: Buffer): string;
}

export interface StoredSession {
  readonly token: string;
  readonly expiresAt: string;
  readonly rotateAfter: string;
}

export interface TokenVault {
  load(): StoredSession | null;
  store(session: StoredSession): 'persisted' | 'memory-only';
  clear(): void;
}

interface MetaRow {
  value: string;
}

function parseSession(json: string): StoredSession | null {
  try {
    const value = JSON.parse(json) as Record<string, unknown> | null;
    if (typeof value !== 'object' || value === null) return null;
    const { token, expiresAt, rotateAfter } = value;
    if (typeof token !== 'string' || typeof expiresAt !== 'string' || typeof rotateAfter !== 'string') return null;
    return { token, expiresAt, rotateAfter };
  } catch {
    return null;
  }
}

function deleteRow(db: SqliteDb | null): void {
  if (!db) return;
  try {
    db.prepare('DELETE FROM account_meta WHERE key = ?').run(SESSION_META_KEY);
  } catch {
    // A row that cannot be deleted is read again, and deleted again, on the next start.
  }
}

export function createTokenVault(db: SqliteDb | null, box: SecretBox): TokenVault {
  let memory: StoredSession | null = null;

  return {
    load() {
      if (memory !== null) return memory;
      if (!db || !box.isAvailable()) return null;
      let stored: string | undefined;
      try {
        const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(SESSION_META_KEY) as
          | MetaRow
          | undefined;
        stored = row?.value;
      } catch {
        return null;
      }
      if (stored === undefined) return null;
      let session: StoredSession | null = null;
      try {
        session = parseSession(box.decrypt(Buffer.from(stored, 'base64')));
      } catch {
        session = null;
      }
      if (session === null) {
        deleteRow(db);
        return null;
      }
      memory = session;
      return session;
    },
    store(session) {
      memory = session;
      if (db && box.isAvailable()) {
        try {
          const value = box.encrypt(JSON.stringify(session)).toString('base64');
          db.prepare(
            'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
          ).run(SESSION_META_KEY, value);
          return 'persisted';
        } catch {
          // Falls through: the session is kept for this run only.
        }
      }
      deleteRow(db);
      return 'memory-only';
    },
    clear() {
      memory = null;
      deleteRow(db);
    },
  };
}
