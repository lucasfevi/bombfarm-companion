import type { SqliteDb } from '../storage/index.js';

/**
 * Remembers across runs that the "still running in the tray" notice was shown. One row in the
 * existing `account_meta` key/value table, value = JSON `{ shownAt }`. Same posture as the
 * consent store: no new table, no migration, no handle to close, and a failed write is
 * swallowed — the worst case is one extra notice on the next run. An unreadable or malformed
 * row reads as not-shown for the same reason.
 */
const SHELL_NOTICE_META_KEY = 'shell_notice_v1';

interface MetaRow {
  value: string;
}

export interface ShellNoticeStore {
  hasShown(): boolean;
  markShown(): void;
}

export function createShellNoticeStore(
  db: SqliteDb | null,
  now: () => Date = () => new Date(),
): ShellNoticeStore {
  return {
    hasShown(): boolean {
      if (!db) return false;
      try {
        const row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(SHELL_NOTICE_META_KEY) as
          | MetaRow
          | undefined;
        if (!row) return false;
        const parsed: unknown = JSON.parse(row.value);
        return (
          typeof parsed === 'object' &&
          parsed !== null &&
          typeof (parsed as Record<string, unknown>).shownAt === 'string'
        );
      } catch {
        return false;
      }
    },

    markShown(): void {
      if (!db) return;
      try {
        db.prepare(
          'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
        ).run(SHELL_NOTICE_META_KEY, JSON.stringify({ shownAt: now().toISOString() }));
      } catch {
        // Best-effort: a lost write means one extra notice next run, never a broken launch.
      }
    },
  };
}
