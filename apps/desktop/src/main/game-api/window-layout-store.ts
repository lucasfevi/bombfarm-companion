import type { MiniLiveLayoutPatch, MiniLiveLayoutView } from '@bombfarm/contracts';
import type { SqliteDb } from '../storage/index.js';
import {
  WINDOW_LAYOUT_META_KEY,
  type MainWindowLayout,
  type MiniLiveLayoutStored,
  type WindowLayoutDocument,
} from '../shell/window-layout.js';

interface MetaRow {
  value: string;
}

export const DEFAULT_MINI_LAYOUT_VIEW: MiniLiveLayoutView = {
  showEarnings: true,
  showMap: true,
  showHeroes: false,
  axis: 'vertical',
};

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

function parseMiniBounds(value: unknown): MiniLiveLayoutStored['bounds'] | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (!isFiniteNumber(record.displayId)) return null;
  if (!isFiniteNumber(record.x)) return null;
  if (!isFiniteNumber(record.y)) return null;
  if (!isFiniteNumber(record.width)) return null;
  if (!isFiniteNumber(record.height)) return null;
  return {
    displayId: record.displayId,
    x: record.x,
    y: record.y,
    width: record.width,
    height: record.height,
  };
}

function parseMiniGrowthAxis(value: unknown): MiniLiveLayoutStored['axis'] | null {
  return value === 'vertical' || value === 'horizontal' ? value : null;
}

export function parseMiniLiveLayoutPatch(value: unknown): MiniLiveLayoutPatch | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const axis = parseMiniGrowthAxis(record.axis);
  if (!axis) return null;
  if (typeof record.showEarnings !== 'boolean') return null;
  if (typeof record.showMap !== 'boolean') return null;
  if (typeof record.showHeroes !== 'boolean') return null;
  return {
    showEarnings: record.showEarnings,
    showMap: record.showMap,
    showHeroes: record.showHeroes,
    axis,
  };
}

function parseMiniLiveLayout(value: unknown): MiniLiveLayoutStored | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const record = value as Record<string, unknown>;
  const bounds = parseMiniBounds(record.bounds);
  const axis = parseMiniGrowthAxis(record.axis);
  if (!bounds || !axis) return null;
  if (typeof record.showEarnings !== 'boolean') return null;
  if (typeof record.showMap !== 'boolean') return null;
  if (typeof record.showHeroes !== 'boolean') return null;
  if (typeof record.wasOpen !== 'boolean') return null;
  return {
    bounds,
    showEarnings: record.showEarnings,
    showMap: record.showMap,
    showHeroes: record.showHeroes,
    axis,
    wasOpen: record.wasOpen,
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
  if (record.mini === undefined) {
    return { schemaVersion: 1, main };
  }
  const mini = parseMiniLiveLayout(record.mini);
  if (!mini) {
    return { schemaVersion: 1, main };
  }
  return { schemaVersion: 1, main, mini };
}

function viewFromMini(mini: MiniLiveLayoutStored): MiniLiveLayoutView {
  return {
    showEarnings: mini.showEarnings,
    showMap: mini.showMap,
    showHeroes: mini.showHeroes,
    axis: mini.axis,
  };
}

function isAllSectionsOff(patch: MiniLiveLayoutPatch): boolean {
  return !patch.showEarnings && !patch.showMap && !patch.showHeroes;
}

export interface WindowLayoutStore {
  read(): WindowLayoutDocument | null;
  write(doc: WindowLayoutDocument): { persisted: boolean };
  /** Replaces the main window's bounds while keeping whatever the mini window has stored. */
  writeMain(main: MainWindowLayout): { persisted: boolean };
  getLayout(): MiniLiveLayoutView;
  setLayout(patch: MiniLiveLayoutPatch): MiniLiveLayoutView;
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

    writeMain(main: MainWindowLayout): { persisted: boolean } {
      const mini = this.read()?.mini;
      return this.write(mini ? { schemaVersion: 1, main, mini } : { schemaVersion: 1, main });
    },

    getLayout(): MiniLiveLayoutView {
      const doc = this.read();
      if (!doc?.mini) {
        return DEFAULT_MINI_LAYOUT_VIEW;
      }
      return viewFromMini(doc.mini);
    },

    setLayout(patch: MiniLiveLayoutPatch): MiniLiveLayoutView {
      const doc = this.read();
      const previousView = doc?.mini ? viewFromMini(doc.mini) : DEFAULT_MINI_LAYOUT_VIEW;
      if (isAllSectionsOff(patch)) {
        return previousView;
      }
      if (!doc) {
        return patch;
      }

      const nextMini: MiniLiveLayoutStored = {
        bounds: doc.mini?.bounds ?? {
          displayId: doc.main.displayId,
          x: 0,
          y: 0,
          width: 320,
          height: 200,
        },
        wasOpen: doc.mini?.wasOpen ?? false,
        showEarnings: patch.showEarnings,
        showMap: patch.showMap,
        showHeroes: patch.showHeroes,
        axis: patch.axis,
      };
      const nextDoc: WindowLayoutDocument = { schemaVersion: 1, main: doc.main, mini: nextMini };
      this.write(nextDoc);
      return patch;
    },
  };
}
