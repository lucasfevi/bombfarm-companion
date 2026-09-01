import type { SqliteDb } from '../storage/index.js';
import {
  WINDOW_LAYOUT_META_KEY,
  type MainWindowLayout,
  type WindowLayoutDocument,
} from '../shell/window-layout.js';

interface MetaRow {
  value: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseMainWindowLayout(value: unknown): MainWindowLayout | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isFiniteNumber(record.displayId)) return null;
  if (!isFiniteNumber(record.x)) return null;
  if (!isFiniteNumber(record.y)) return null;
  if (!isFiniteNumber(record.width)) return null;
  if (!isFiniteNumber(record.height)) return null;
  if (typeof record.isMaximized !== 'boolean') return null;
  return {
    displayId: record.displayId,
    x: record.x,
    y: record.y,
    width: record.width,
    height: record.height,
    isMaximized: record.isMaximized,
  };
}

function parseWindowLayoutDocument(parsed: unknown): WindowLayoutDocument | null {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 1) {
    return null;
  }
  const main = parseMainWindowLayout(record.main);
  if (!main) {
    return null;
  }
  return { schemaVersion: 1, main };
}

export interface WindowLayoutStore {
  read(): WindowLayoutDocument | null;
  write(doc: WindowLayoutDocument): { persisted: boolean };
}

export function createWindowLayoutStore(db: SqliteDb | null): WindowLayoutStore {
  return {
    read(): WindowLayoutDocument | null {
      if (!db) {
        return null;
      }
      let row: MetaRow | undefined;
      try {
        row = db.prepare('SELECT value FROM account_meta WHERE key = ?').get(WINDOW_LAYOUT_META_KEY) as
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

      return parseWindowLayoutDocument(parsed);
    },

    write(doc: WindowLayoutDocument): { persisted: boolean } {
      if (!db) {
        return { persisted: false };
      }
      try {
        db.prepare(
          'INSERT INTO account_meta (key, value) VALUES (?, ?) ON CONFLICT DO UPDATE SET value = excluded.value',
        ).run(WINDOW_LAYOUT_META_KEY, JSON.stringify(doc));
      } catch {
        return { persisted: false };
      }
      return { persisted: true };
    },
  };
}
