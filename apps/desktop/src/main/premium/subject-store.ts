import type { SqliteDb } from '../storage/index.js';
import type { SecretBox } from './token-vault.js';

const SUBJECT_META_KEY = 'premium_subject_v1';

/**
 * Who the stored sign-in session belongs to, sealed with the same box as the session itself. It is
 * what lets a restart find that user's sealed licence rows before the account answers. It is
 * written when the account names the user and cleared wherever the session is.
 */
export interface SubjectStore {
  load(): string | null;
  store(subject: string): void;
  clear(): void;
}

interface MetaRow {
  value: string;
}

function deleteRow(db: SqliteDb | null): void {
  if (!db) return;
  try {
    db.prepare('DELETE FROM account_meta WHERE key = ?').run(SUBJECT_META_KEY);
  } catch {
    // A row that cannot be deleted is read again, and deleted again, on the next start.
  }
}

function parseSubject(json: string): string | null {
  try {
    const value = JSON.parse(json) as Record<string, unknown> | null;
    if (typeof value !== 'object' || value === null) return null;
    const { subject } = value;
    return typeof subject === 'string' && subject !== '' ? subject : null;
  } catch {
    return null;
  }
}

export function createSubjectStore(db: SqliteDb | null, box: SecretBox): SubjectStore {
  return {
    load() {
      if (!db || !box.isAvailable()) return null;
      let stored: string | undefined;
      try {
        stored = (db.prepare('SELECT value FROM account_meta WHERE key = ?').get(SUBJECT_META_KEY) as MetaRow | undefined)
          ?.value;
      } catch {
        return null;
      }
      if (stored === undefined) return null;
      let subject: string | null = null;
      try {
        subject = parseSubject(box.decrypt(Buffer.from(stored, 'base64')));
      } catch {
        subject = null;
      }
      if (subject === null) deleteRow(db);
      return subject;
    },
    store(subject) {
      if (!db || !box.isAvailable()) return;
      try {
        const value = box.encrypt(JSON.stringify({ subject })).toString('base64');
        db.prepare(
          'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
        ).run(SUBJECT_META_KEY, value);
      } catch {
        // Not persisted: this run still knows the subject, a restart will learn it again.
      }
    },
    clear() {
      deleteRow(db);
    },
  };
}
