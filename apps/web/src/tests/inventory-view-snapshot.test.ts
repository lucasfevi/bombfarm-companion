import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildInventoryView } from '@bombfarm/domain/inventory-view';
import {
  hasInventoryRows,
  inventoryViewSnapshotFrom,
} from '@/features/home/model/use-inventory-view-snapshot';
import { loadInventoryView, saveInventoryView } from '@/shared/lib/inventory-view-storage';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

const SAVE_WITH_221_ITEMS = join(
  WEB_PACKAGE_ROOT,
  '../../packages/domain/tests/fixtures/sheet-math/save-20260823-13heroes-crit-points.json',
);

function savedItems() {
  const raw = JSON.parse(readFileSync(SAVE_WITH_221_ITEMS, 'utf8')) as { items: unknown[] };
  return buildInventoryView(raw.items).items;
}

describe('the front page’s inventory snapshot', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => store.clear(),
      },
    });
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'localStorage');
  });

  it('nothing ever written reads as no view', () => {
    const loaded = loadInventoryView();

    expect(loaded.importedAt).toBe(0);
    expect(inventoryViewSnapshotFrom(loaded)).toBeNull();
    expect(hasInventoryRows(null)).toBe(false);
  });

  it('a stored view reads back with its rows and per-kind groups', () => {
    expect(saveInventoryView(savedItems(), 1_700_000_000_000)).toBe(true);
    const view = inventoryViewSnapshotFrom(loadInventoryView());

    expect(view?.items).toHaveLength(221);
    expect(view?.groups.map((group) => [group.kind, group.count])).toEqual([
      ['equipment', 137],
      ['gem', 2],
      ['key', 6],
      ['time', 70],
      ['stone', 4],
      ['chest', 2],
    ]);
    expect(hasInventoryRows(view)).toBe(true);

    saveInventoryView([], 1_700_000_000_001);
    const emptied = inventoryViewSnapshotFrom(loadInventoryView());
    expect(emptied).not.toBeNull();
    expect(hasInventoryRows(emptied)).toBe(false);
  });

  it('the hook reads on mount and re-reads only when the store’s inventory stamp changes', () => {
    const source = readFileSync(
      join(WEB_PACKAGE_ROOT, 'src/features/home/model/use-inventory-view-snapshot.ts'),
      'utf8',
    );
    const stampSelector = /const importedAt = usePlannerStore\(\(state\) => state\.inventory\.importedAt\);/;
    const effect = /useEffect\(\(\) => \{\s*setView\(inventoryViewSnapshotFrom\(loadInventoryView\(\)\)\);\s*\}, \[importedAt\]\);/;

    expect(source).toMatch(stampSelector);
    expect(source).toMatch(effect);
    expect(source.match(/useEffect\(/g)).toHaveLength(1);
    expect(source.match(/loadInventoryView\(\)/g)).toHaveLength(1);
  });
});
