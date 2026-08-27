import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapInventoryItem } from '@bombfarm/domain/inventory';
import { scaledValores } from '@bombfarm/domain/gear';
import {
  buildInventoryView,
  groupInventoryByKind,
  mapInventoryHeroes,
  mapInventoryViewItem,
  resolveItemKind,
  filterInventoryView,
  isStackableKind,
  kindsInView,
  heroIdsInView,
  rarityIndicesInView,
  sortInventoryView,
  EMPTY_INVENTORY_FILTER,
  DEFAULT_INVENTORY_SORT,
  type InventorySort,
  ITEM_KINDS,
  type InventoryViewItem,
  type ItemKind,
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
    const counts = Object.fromEntries(view.groups.map((group) => [group.kind, group.count]));
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
    expect(gloves!.stats).toEqual([{ name: 'dmg', code: 0, unit: 'flat', value: 19.25, effective: 19.25 }]);
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
    expect(resolveItemKind(null, 'time_part_incomum')).toBe('time');
    expect(resolveItemKind(null, 'map_key_incomum')).toBe('key');
  });

  it('does not let a missing category promote a gem or house part out of its prefix bucket', () => {
    expect(resolveItemKind(null, 'gem_ruby')).toBe('gem');
    expect(resolveItemKind(null, 'time_part_gear')).toBe('time');
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
    expect(item!.stats).toEqual([{ name: null, code: 99, unit: 'pct', value: 1, effective: 2 }]);
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

  it('returns no groups for an empty inventory rather than one empty group per kind', () => {
    expect(groupInventoryByKind([])).toEqual([]);
    expect(ITEM_KINDS.length).toBe(7);
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

describe('mapInventoryViewItem across the storage round trip', () => {
  const wireRow = {
    id: 'i1',
    def_id: 'glacier_arma',
    category: 0,
    rarity: 4,
    level: 60,
    upgrade: 12,
    sell_value: 1234,
    market_state: 1,
    in_stash: true,
    locked: true,
    tradable: true,
    equipped_on: 'h1',
    stats: [{ stat: 2, value: 10, effective: 12 }],
  };

  it('re-reads a mapped row into itself, so a reload shows what the import showed', () => {
    const once = mapInventoryViewItem(wireRow)!;
    const reloaded = mapInventoryViewItem(JSON.parse(JSON.stringify(once)) as unknown)!;
    expect(reloaded).toEqual(once);
  });

  it('keeps the rarity a reload used to flatten to comum', () => {
    const once = mapInventoryViewItem(wireRow)!;
    const reloaded = mapInventoryViewItem(JSON.parse(JSON.stringify(once)) as unknown)!;
    expect(once.rarityIdx).toBe(4);
    expect(reloaded.rarityIdx).toBe(4);
    expect(reloaded.rarityCode).toBe('lendaria');
  });

  it('keeps sell value, market state, stash flag and stats across the same trip', () => {
    const reloaded = mapInventoryViewItem(
      JSON.parse(JSON.stringify(mapInventoryViewItem(wireRow))) as unknown,
    )!;
    expect(reloaded.sellValueGold).toBe(1234);
    expect(reloaded.marketBlocked).toBe(true);
    expect(reloaded.inStash).toBe(true);
    expect(reloaded.stats).toEqual([{ name: 'velocidade', code: 2, unit: 'pct', value: 10, effective: 12 }]);
  });
});

describe('mapInventoryHeroes', () => {
  it('keys hero identity by the id an item equippedBy holds', () => {
    const heroes = mapInventoryHeroes([
      { id: 'h1', name: 'Kendo', rarity: 5, level: 157, rank: 'S', skin: 3 },
      { id: 'h2', name: 'Dano', rarity: 3, level: 60 },
    ]);
    expect(heroes.get('h1')).toEqual({
      id: 'h1',
      name: 'Kendo',
      rarityIdx: 5,
      level: 157,
      rank: 'S',
      skin: 3,
    });

    const item = mapInventoryViewItem({ id: 'i1', def_id: 'glacier_arma', equipped_on: 'h2' })!;
    expect(heroes.get(item.equippedBy!)?.name).toBe('Dano');
  });

  it('falls back to the hero id as a name and skips rows with no id at all', () => {
    const heroes = mapInventoryHeroes([{ id: 'h3' }, { name: 'no id' }, null]);
    expect(heroes.size).toBe(1);
    expect(heroes.get('h3')).toEqual({ id: 'h3', name: 'h3', rarityIdx: 0, level: 1, rank: '', skin: 0 });
  });

  it('returns an empty map when the payload carries no heroes array', () => {
    expect(mapInventoryHeroes(undefined).size).toBe(0);
  });
});

/**
 * The wire's `category` is the game's own classification and partitions every row. These six
 * codes are read off a 63-save corpus; before this, only code 0 was known and a chest or a skill
 * stone fell through to `other`.
 */
describe('resolveItemKind reads the wire category as the total classifier', () => {
  const CODES: [number, string, ItemKind][] = [
    [0, 'steel_luva', 'equipment'],
    [1, 'chest_item_90', 'chest'],
    [2, 'gem_oceanite', 'gem'],
    [3, 'time_part_lendaria', 'time'],
    [4, 'map_key_mitico', 'key'],
    [5, 'skill_stone_comum', 'stone'],
  ];

  it.each(CODES)('files category %i (%s) as %s', (code, defId, kind) => {
    expect(resolveItemKind(code, defId)).toBe(kind);
  });

  it('still classifies a chest and a skill stone from the def_id when no category is sent', () => {
    expect(resolveItemKind(null, 'chest_gem_2')).toBe('chest');
    expect(resolveItemKind(null, 'skill_stone_mitico')).toBe('stone');
  });
});

describe('stacking', () => {
  const rows = (defId: string, rarity: number, count: number, sell = 220) =>
    Array.from(
      { length: count },
      (_, index) =>
        mapInventoryViewItem({
          id: `${defId}-${index}`,
          def_id: defId,
          category: 4,
          rarity,
          sell_value: String(sell),
        })!,
    );

  it('collapses identical keys into one counted entry, and sums the stack sell value', () => {
    const groups = groupInventoryByKind(rows('map_key_epico', 3, 11));
    const keys = groups.find((group) => group.kind === 'key')!;

    expect(keys.count).toBe(11);
    expect(keys.entries).toHaveLength(1);
    expect(keys.entries[0].count).toBe(11);
    expect(keys.entries[0].sellValueGold).toBe(11 * 220);
  });

  it('keeps two rarities of the same family apart', () => {
    const keys = groupInventoryByKind([
      ...rows('map_key_epico', 3, 4),
      ...rows('map_key_raro', 2, 2),
    ]).find((group) => group.kind === 'key')!;
    expect(keys.entries.map((entry) => entry.count).sort()).toEqual([2, 4]);
  });

  it('never stacks gear, because forge and level make two swords different objects', () => {
    expect(isStackableKind('equipment')).toBe(false);
    const gear = [
      mapInventoryViewItem({ id: 'a', def_id: 'ember_luva', category: 0, rarity: 0, upgrade: 0 })!,
      mapInventoryViewItem({ id: 'b', def_id: 'ember_luva', category: 0, rarity: 0, upgrade: 12 })!,
    ];
    const group = groupInventoryByKind(gear)[0];
    expect(group.entries).toHaveLength(2);
    expect(group.entries.every((entry) => entry.count === 1)).toBe(true);
  });
});

describe('item stats', () => {
  it('marks dmg flat and every other roll percent, so a caller knows which to suffix', () => {
    const item = mapInventoryViewItem({
      id: '1',
      def_id: 'steel_luva',
      category: 0,
      rarity: 2,
      level: 20,
      upgrade: 8,
      stats: [
        { stat: 0, value: 55, effective: 90.2 },
        { stat: 5, value: 0.4, effective: 0.656 },
      ],
    })!;
    expect(item.stats.map((stat) => [stat.name, stat.unit])).toEqual([
      ['dmg', 'flat'],
      ['penetracao', 'pct'],
    ]);
  });

  /**
   * The fallback is a second implementation of the planner's own `scaledValores`, kept separate
   * only so this module does not pull in the loadout model. Pinning the two together is what
   * stops them drifting after a catalog rescale.
   */
  it('derives the same rolls the planner would, when a row arrives with none', () => {
    const derived = mapInventoryViewItem({
      id: '1',
      def_id: 'steel_luva',
      category: 0,
      rarity: 2,
      level: 20,
      upgrade: 8,
    })!;
    const planner = scaledValores('steel_luva', 2, 20, 8);

    expect(derived.stats).toHaveLength(planner.length);
    for (const [index, stat] of derived.stats.entries()) {
      expect(stat.name).toBe(planner[index].stat);
      expect(stat.effective).toBeCloseTo(planner[index].valor, 9);
      expect(stat.unit).toBe(planner[index].unit);
    }
  });

  it('honours the rarity stat count, so a Comum shows one roll and a Raro three', () => {
    const at = (rarity: number) =>
      mapInventoryViewItem({ id: String(rarity), def_id: 'steel_luva', category: 0, rarity, level: 20 })!.stats
        .length;
    expect(at(0)).toBe(1);
    expect(at(2)).toBe(3);
    expect(at(5)).toBe(6);
  });

  it('applies the forge to the catalog fallback, so a +10 does not read as a +0', () => {
    const plain = mapInventoryViewItem({ id: '1', def_id: 'steel_luva', category: 0, rarity: 2, level: 20 })!;
    const forged = mapInventoryViewItem({
      id: '2',
      def_id: 'steel_luva',
      category: 0,
      rarity: 2,
      level: 20,
      upgrade: 10,
    })!;
    expect(forged.stats[0].effective).toBeCloseTo(plain.stats[0].effective * 1.8, 6);
  });
});

describe('filterInventoryView', () => {
  const view = () =>
    buildInventoryView([
      { id: '1', def_id: 'glacier_arma', category: 0, rarity: 4, level: 60, equipped_on: 'h1' },
      { id: '2', def_id: 'ember_luva', category: 0, rarity: 0, level: 10 },
      { id: '3', def_id: 'map_key_epico', category: 4, rarity: 3 },
      { id: '4', def_id: 'map_key_epico', category: 4, rarity: 3 },
    ]);

  const nameOf = (item: InventoryViewItem) => item.defId;

  it('returns the same view object when nothing is filtered, so React skips the rerender', () => {
    const original = view();
    expect(filterInventoryView(original, EMPTY_INVENTORY_FILTER, nameOf)).toBe(original);
  });

  it('narrows on free text, ignoring case', () => {
    const filtered = filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, text: 'GLACIER' }, nameOf);
    expect(filtered.items.map((item) => item.id)).toEqual(['1']);
  });

  it('ignores accents, so a plain-ASCII query still finds an accented name', () => {
    const accented = (item: InventoryViewItem) => (item.rarityIdx === 3 ? 'Épico' : 'Comum');
    const filtered = filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, text: 'epico' }, accented);
    expect(filtered.items).toHaveLength(2);
  });

  it('requires every word, so two terms narrow rather than widen', () => {
    const byName = (item: InventoryViewItem) => `${item.defId} rarity${item.rarityIdx}`;
    expect(
      filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, text: 'map rarity3' }, byName).items,
    ).toHaveLength(2);
    expect(
      filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, text: 'map rarity4' }, byName).items,
    ).toHaveLength(0);
  });

  it('narrows on kind and on rarity', () => {
    expect(
      filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, kinds: ['key'] }, nameOf).items,
    ).toHaveLength(2);
    expect(
      filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, rarities: [0] }, nameOf).items,
    ).toHaveLength(1);
  });

  it('narrows to equipped items only', () => {
    const filtered = filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, equippedOnly: true }, nameOf);
    expect(filtered.items.map((item) => item.id)).toEqual(['1']);
  });

  /** The bug this guards: filtering the GROUPS rather than the items would leave a key stack
   *  still reading its unfiltered count. */
  it('recounts a stack after filtering rather than carrying the old count', () => {
    const filtered = filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, rarities: [3] }, nameOf);
    const keys = filtered.groups.find((group) => group.kind === 'key')!;
    expect(keys.entries[0].count).toBe(2);

    const none = filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, kinds: ['gem'] }, nameOf);
    expect(none.groups).toEqual([]);
  });

  it('offers only the kinds and rarities the account actually holds', () => {
    expect(kindsInView(view())).toEqual(['equipment', 'key']);
    expect(rarityIndicesInView(view())).toEqual([0, 3, 4]);
  });
});

describe('hero filter', () => {
  const view = () =>
    buildInventoryView([
      { id: '1', def_id: 'glacier_arma', category: 0, rarity: 4, level: 60, equipped_on: 'h1' },
      { id: '2', def_id: 'ember_luva', category: 0, rarity: 0, level: 10, equipped_on: 'h2' },
      { id: '3', def_id: 'clay_bota', category: 0, rarity: 2, level: 40 },
      { id: '4', def_id: 'map_key_epico', category: 4, rarity: 3, equipped_on: 'h1' },
    ]);

  const nameOf = (item: InventoryViewItem) => item.defId;

  it('offers every hero that wears something, and no one else', () => {
    expect(heroIdsInView(view())).toEqual(['h1', 'h2']);
  });

  it('narrows to one hero across every kind they wear', () => {
    const filtered = filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, heroIds: ['h1'] }, nameOf);
    expect(filtered.items.map((item) => item.id)).toEqual(['1', '4']);
    expect(filtered.groups.map((group) => group.kind)).toEqual(['equipment', 'key']);
  });

  it('drops loose items, since nobody is wearing them', () => {
    const filtered = filterInventoryView(view(), { ...EMPTY_INVENTORY_FILTER, heroIds: ['h1', 'h2'] }, nameOf);
    expect(filtered.items.map((item) => item.id)).not.toContain('3');
  });

  it('combines with the other filters rather than replacing them', () => {
    const filtered = filterInventoryView(
      view(),
      { ...EMPTY_INVENTORY_FILTER, heroIds: ['h1'], kinds: ['equipment'] },
      nameOf,
    );
    expect(filtered.items.map((item) => item.id)).toEqual(['1']);
  });
});

describe('sortInventoryView', () => {
  const view = () =>
    buildInventoryView([
      { id: '1', def_id: 'glacier_arma', category: 0, rarity: 4, level: 60, sell_value: '900' },
      { id: '2', def_id: 'ember_luva', category: 0, rarity: 0, level: 10, sell_value: '100' },
      { id: '3', def_id: 'clay_bota', category: 0, rarity: 2, level: 40, sell_value: '500' },
      { id: '4', def_id: 'map_key_epico', category: 4, rarity: 3, sell_value: '220' },
    ]);

  const nameOf = (item: InventoryViewItem) => item.defId;
  const gearOrder = (sort: InventorySort) =>
    sortInventoryView(view(), sort, nameOf)
      .groups.find((group) => group.kind === 'equipment')
      ?.entries.map((entry) => entry.item.id);

  it('defaults to best-first, which is what a player scanning for an upgrade wants', () => {
    expect(DEFAULT_INVENTORY_SORT).toEqual({ key: 'rarity', direction: 'desc' });
    expect(gearOrder(DEFAULT_INVENTORY_SORT)).toEqual(['1', '3', '2']);
  });

  it.each([
    ['rarity', 'asc', ['2', '3', '1']],
    ['rarity', 'desc', ['1', '3', '2']],
    ['level', 'asc', ['2', '3', '1']],
    ['value', 'desc', ['1', '3', '2']],
    ['name', 'asc', ['3', '2', '1']],
  ] as const)('sorts by %s %s', (key, direction, expected) => {
    expect(gearOrder({ key, direction })).toEqual([...expected]);
  });

  /** The groups are the page's structure; a sort that reordered them would file a key between
   *  two swords. */
  it('reorders within a group and never across groups', () => {
    const sorted = sortInventoryView(view(), { key: 'value', direction: 'desc' }, nameOf);
    expect(sorted.groups.map((group) => group.kind)).toEqual(['equipment', 'key']);
  });

  it('breaks a tie by name, so a rarity sort still lists a set together', () => {
    const tied = buildInventoryView([
      { id: 'b', def_id: 'glacier_bota', category: 0, rarity: 2, level: 60 },
      { id: 'a', def_id: 'glacier_arma', category: 0, rarity: 2, level: 60 },
    ]);
    const order = sortInventoryView(tied, { key: 'rarity', direction: 'desc' }, nameOf).groups[0].entries.map(
      (entry) => entry.item.id,
    );
    expect(order).toEqual(['a', 'b']);
  });

  it('leaves the item list itself untouched — only the grouped entries move', () => {
    const original = view();
    const sorted = sortInventoryView(original, { key: 'value', direction: 'asc' }, nameOf);
    expect(sorted.items).toBe(original.items);
    expect(sorted.skipped).toBe(original.skipped);
  });
});
