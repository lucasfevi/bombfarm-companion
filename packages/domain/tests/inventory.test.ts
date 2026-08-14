import { describe, expect, it } from 'vitest';
import { loadFixtureJson } from './helpers/sheet-math-fixtures';
import {
  mapInventoryItem,
  normalizeInventorySnapshot,
  type InventoryItem,
} from '@bombfarm/domain/inventory';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function firstGearItem(raw: unknown): Record<string, unknown> {
  const items = isObject(raw) && Array.isArray(raw.items) ? raw.items : [];
  const found = items.find(
    (item) => isObject(item) && Math.round(Number(item.category)) === 0,
  );
  if (!found || !isObject(found)) throw new Error('fixture has no category:0 item');
  return found;
}

describe('mapInventoryItem', () => {
  // MP5 F1 (AD-068 class (a) — read from the capture): re-pointed onto
  // payload-20260812-8heroes.json, whose first category:0 item is a different real gear
  // item (ember_luva, not ember_calca) — every expected value below is read from it, not
  // carried over from the deleted fixture.
  it('maps the fixture first gear item to ember_luva with equipped metadata', () => {
    const raw = loadFixtureJson('payload-20260812-8heroes.json');
    const item = mapInventoryItem(firstGearItem(raw));
    expect(item).not.toBeNull();
    expect(item!.defId).toBe('ember_luva');
    expect(item!.rarityIdx).toBe(0);
    expect(item!.level).toBe(10);
    expect(item!.upgrade).toBe(0);
    expect(item!.equipped).toBe(true);
    expect(item!.equippedBy).toBe('555');
    expect(item!.slot).toBe('luva');
    expect(item!.defResolved).toBe(true);
    expect(item!.marketBlocked).toBe(false);
  });

  it('returns null for non-gear categories', () => {
    expect(mapInventoryItem({ category: 1, def_id: 'gem' })).toBeNull();
    expect(mapInventoryItem({ category: 4, def_id: 'material' })).toBeNull();
  });

  it('sets defResolved false for an unknown def_id without throwing', () => {
    const item = mapInventoryItem({
      category: 0,
      id: 'x1',
      def_id: 'not_in_catalog_xyz',
      rarity: 0,
      level: 10,
      upgrade: 0,
      equipped_on: '',
      market_state: 0,
    });
    expect(item).toMatchObject({
      defId: 'not_in_catalog_xyz',
      defResolved: false,
      slot: null,
    });
  });

  it('sets marketBlocked true when market_state is not zero', () => {
    const item = mapInventoryItem({
      category: 0,
      id: 'm1',
      def_id: 'ember_calca',
      rarity: 2,
      level: 10,
      upgrade: 0,
      equipped_on: '',
      market_state: 2,
    });
    expect(item?.marketBlocked).toBe(true);
  });

  it('derives equipped false and equippedBy null for spare items', () => {
    const item = mapInventoryItem({
      category: 0,
      id: 's1',
      def_id: 'ember_calca',
      rarity: 2,
      level: 10,
      upgrade: 0,
      equipped_on: '',
      market_state: 0,
    });
    expect(item?.equipped).toBe(false);
    expect(item?.equippedBy).toBeNull();
  });

  it('resolves slot from the catalog definition, not equip_slot', () => {
    const item = mapInventoryItem({
      category: 0,
      id: 'slot-test',
      def_id: 'ember_calca',
      equip_slot: 99,
      rarity: 2,
      level: 10,
      upgrade: 0,
      equipped_on: '',
      market_state: 0,
    });
    expect(item?.slot).toBe('calca');
  });
});

describe('normalizeInventorySnapshot', () => {
  const sampleItem: InventoryItem = {
    id: '1',
    defId: 'ember_calca',
    rarityIdx: 2,
    level: 10,
    upgrade: 8,
    slot: 'calca',
    equipped: true,
    equippedBy: '43040',
    defResolved: true,
    marketBlocked: false,
  };

  it('returns an empty snapshot for null, undefined, string, and number', () => {
    for (const raw of [null, undefined, 'nope', 42]) {
      expect(normalizeInventorySnapshot(raw)).toEqual({
        version: 1,
        importedAt: 0,
        items: [],
      });
    }
  });

  it('returns an empty snapshot when items is not an array', () => {
    expect(normalizeInventorySnapshot({ version: 1, items: 'nope' })).toEqual({
      version: 1,
      importedAt: 0,
      items: [],
    });
  });

  it('drops non-object entries from a partially valid items array', () => {
    const snapshot = normalizeInventorySnapshot({
      version: 1,
      importedAt: 100,
      items: [null, 'bad', sampleItem],
    });
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]?.id).toBe('1');
    expect(snapshot.importedAt).toBe(100);
  });

  it('round-trips a normalized snapshot', () => {
    const snapshot = normalizeInventorySnapshot({
      version: 1,
      importedAt: 1234,
      items: [sampleItem],
    });
    expect(snapshot).toEqual({
      version: 1,
      importedAt: 1234,
      items: [sampleItem],
    });
  });

  it('re-resolves defResolved from defId on load', () => {
    const snapshot = normalizeInventorySnapshot({
      version: 1,
      importedAt: 0,
      items: [{ ...sampleItem, defId: 'missing_def', defResolved: true }],
    });
    expect(snapshot.items[0]?.defResolved).toBe(false);
  });

  it('drops items missing id or defId', () => {
    const snapshot = normalizeInventorySnapshot({
      version: 1,
      importedAt: 0,
      items: [{ defId: 'ember_calca' }, { id: 'only-id' }],
    });
    expect(snapshot.items).toHaveLength(0);
  });
});
