import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapInventoryItem } from '@bombfarm/domain/inventory';
import {
  buildInventoryView,
  groupInventoryByKind,
  mapInventoryViewItem,
  resolveItemKind,
  ITEM_KINDS,
} from '@bombfarm/domain/inventory-view';

function loadPayloadItems(): unknown[] {
  const path = join(__dirname, 'fixtures', 'sheet-math', 'payload-20260812-8heroes.json');
  const payload = JSON.parse(readFileSync(path, 'utf8')) as { items?: unknown[] };
  return payload.items ?? [];
}

describe('buildInventoryView over the calibration capture', () => {
  it('keeps every one of the 30 captured rows, where the optimizer model keeps only the 27 gear ones', () => {
    const raw = loadPayloadItems();
    const view = buildInventoryView(raw);

    expect(raw.length).toBe(30);
    expect(view.items.length).toBe(30);
    expect(view.skipped).toBe(0);

    const keptByOptimizer = raw.filter((item) => mapInventoryItem(item as Record<string, unknown>) !== null);
    expect(keptByOptimizer.length).toBe(27);
  });

  it('files the capture as 27 equipment and 3 keys, and nothing else', () => {
    const view = buildInventoryView(loadPayloadItems());
    const counts = Object.fromEntries(view.groups.map((group) => [group.kind, group.items.length]));
    expect(counts).toEqual({ equipment: 27, key: 3 });
  });

  it('carries the fields the optimizer model drops, so the tab can show them', () => {
    const view = buildInventoryView(loadPayloadItems());
    const gloves = view.items.find((item) => item.defId === 'ember_luva');

    expect(gloves).toBeDefined();
    expect(gloves!.set).toBe('ember');
    expect(gloves!.slot).toBe('luva');
    expect(gloves!.sellValueGold).toBe(100);
    expect(gloves!.sellable).toBe(true);
    expect(gloves!.tradable).toBe(false);
    expect(gloves!.inStash).toBe(false);
    expect(gloves!.equippedBy).toBe('555');
    expect(gloves!.rarityCode).toBe('comum');
    expect(gloves!.stats).toEqual([{ name: 'dmg', code: 0, value: 19.25, effective: 19.25 }]);
  });

  it('reads sell_value through the digit string the wire sends rather than dropping it to zero', () => {
    const view = buildInventoryView(loadPayloadItems());
    const withValue = view.items.filter((item) => item.sellValueGold > 0);
    expect(withValue.length).toBeGreaterThan(0);
    for (const item of withValue) expect(Number.isFinite(item.sellValueGold)).toBe(true);
  });
});

describe('resolveItemKind', () => {
  it('files category 0 as equipment, the one code the catalog corroborates', () => {
    expect(resolveItemKind(0, 'ember_luva')).toBe('equipment');
  });

  it('files a map key by its def_id prefix even though its category code is not established', () => {
    expect(resolveItemKind(4, 'map_key_incomum')).toBe('key');
  });

  it('files an unrecognised category with an unrecognised prefix as other, never as equipment', () => {
    expect(resolveItemKind(9, 'sparkle_thing')).toBe('other');
    expect(resolveItemKind(null, 'sparkle_thing')).toBe('other');
  });

  // The desktop's own fixture bundle carries rows with no `category` at all, and a save export
  // does the same — the catalog is the only thing left that can classify them, and a def_id it
  // resolves is gear by construction.
  it('falls back to the catalog for a row that carries no category, rather than calling it other', () => {
    expect(resolveItemKind(null, 'wooden_arma')).toBe('equipment');
    expect(resolveItemKind(null, 'forest_arma')).toBe('equipment');
  });

  it('still prefers an explicit prefix over the catalog fallback', () => {
    expect(resolveItemKind(null, 'time_part_incomum')).toBe('material');
    expect(resolveItemKind(null, 'map_key_incomum')).toBe('key');
  });

  it('does not let a missing category promote a gem or material out of its prefix bucket', () => {
    expect(resolveItemKind(null, 'gem_ruby')).toBe('gem');
    expect(resolveItemKind(null, 'time_part_gear')).toBe('material');
  });
});

describe('mapInventoryViewItem', () => {
  it('rejects a row with no id or no def_id instead of emitting a blank entry', () => {
    expect(mapInventoryViewItem({ def_id: 'ember_luva' })).toBeNull();
    expect(mapInventoryViewItem({ id: '1' })).toBeNull();
    expect(mapInventoryViewItem(null)).toBeNull();
    expect(mapInventoryViewItem('nope')).toBeNull();
  });

  it('marks an item whose def_id is absent from the catalog as unresolved without throwing', () => {
    const item = mapInventoryViewItem({ id: '7', def_id: 'sparkle_thing', category: 9 });
    expect(item).not.toBeNull();
    expect(item!.defResolved).toBe(false);
    expect(item!.slot).toBeNull();
    expect(item!.kind).toBe('other');
    expect(item!.categoryCode).toBe(9);
  });

  it('keeps the raw category code so an other-bucket row can be identified after a patch', () => {
    expect(mapInventoryViewItem({ id: '1', def_id: 'x', category: 12 })!.categoryCode).toBe(12);
    expect(mapInventoryViewItem({ id: '1', def_id: 'x' })!.categoryCode).toBeNull();
  });

  it('names a stat past the end of the catalog null rather than mislabelling it', () => {
    const item = mapInventoryViewItem({
      id: '1',
      def_id: 'ember_luva',
      category: 0,
      stats: [{ stat: 99, value: 1, effective: 2 }],
    });
    expect(item!.stats).toEqual([{ name: null, code: 99, value: 1, effective: 2 }]);
  });

  it('treats a missing sellable flag as sellable and a missing tradable flag as not tradable', () => {
    const item = mapInventoryViewItem({ id: '1', def_id: 'ember_luva', category: 0 });
    expect(item!.sellable).toBe(true);
    expect(item!.tradable).toBe(false);
  });
});

describe('groupInventoryByKind', () => {
  it('orders groups by ITEM_KINDS and omits the kinds with no items', () => {
    const items = [
      mapInventoryViewItem({ id: '1', def_id: 'sparkle', category: 9 })!,
      mapInventoryViewItem({ id: '2', def_id: 'ember_luva', category: 0 })!,
      mapInventoryViewItem({ id: '3', def_id: 'map_key_incomum', category: 4 })!,
    ];

    expect(groupInventoryByKind(items).map((group) => group.kind)).toEqual(['equipment', 'key', 'other']);
  });

  it('returns no groups for an empty inventory rather than five empty ones', () => {
    expect(groupInventoryByKind([])).toEqual([]);
    expect(ITEM_KINDS.length).toBe(5);
  });
});

// A stored view item is fed back through the mapper on load, so the mapper has to read its own
// output as faithfully as it reads the wire. Every test above feeds it wire-shaped rows only,
// which is exactly why this went unnoticed: `defId` has a fallback for the mapped shape and
// `categoryCode` did not, so gear round-tripped back as `other` while still resolving its name.
describe('mapInventoryViewItem round-trips its own output', () => {
  it('re-reads a mapped gear item as equipment, not as other', () => {
    const once = mapInventoryViewItem({ id: '1', def_id: 'ember_luva', category: 0, rarity: 0, level: 10 });
    expect(once!.kind).toBe('equipment');

    const twice = mapInventoryViewItem(once as unknown as Record<string, unknown>);
    expect(twice!.kind).toBe('equipment');
    expect(twice!.categoryCode).toBe(0);
  });

  it('keeps every kind stable across a second mapping of the whole capture', () => {
    const first = buildInventoryView(loadPayloadItems());
    const second = buildInventoryView(first.items as unknown as unknown[]);

    expect(second.items.length).toBe(first.items.length);
    expect(second.items.map((item) => item.kind)).toEqual(first.items.map((item) => item.kind));
    expect(second.skipped).toBe(0);
  });

  it('keeps an unresolved row in other across the round trip rather than promoting it', () => {
    const once = mapInventoryViewItem({ id: '9', def_id: 'sparkle_thing', category: 7 });
    const twice = mapInventoryViewItem(once as unknown as Record<string, unknown>);
    expect(twice!.kind).toBe('other');
    expect(twice!.categoryCode).toBe(7);
  });
});

describe('buildInventoryView guards', () => {
  it('counts unusable rows in skipped instead of quietly shortening the list', () => {
    const view = buildInventoryView([{ id: '1', def_id: 'ember_luva', category: 0 }, null, { def_id: 'no_id' }]);
    expect(view.items.length).toBe(1);
    expect(view.skipped).toBe(2);
  });

  it('returns an empty view when the payload carries no items array at all', () => {
    expect(buildInventoryView(undefined)).toEqual({ items: [], groups: [], skipped: 0 });
  });
});
