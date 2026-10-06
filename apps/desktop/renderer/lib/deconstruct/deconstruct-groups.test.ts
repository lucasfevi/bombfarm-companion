import { describe, expect, it } from 'vitest';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { deconstructGroups } from './deconstruct-groups';
import { rawGear, rawOther, viewItems } from './test-items';

const labelOf = (item: InventoryViewItem) => `${item.kind}/${String(item.rarityIdx)}/${item.defId}`;

describe('deconstructGroups', () => {
  it('is empty for an empty batch', () => {
    expect(deconstructGroups([], labelOf)).toEqual([]);
  });

  it('counts a kind and rarity once, however many items share them', () => {
    const items = viewItems([
      rawOther('1', 'key_a', 4, { rarity: 3 }),
      rawOther('2', 'key_b', 4, { rarity: 3 }),
      rawOther('3', 'key_c', 4, { rarity: 3 }),
    ]);
    expect(deconstructGroups(items, () => 'Epic Keys')).toEqual([{ id: 'key:3', label: 'Epic Keys', count: 3 }]);
  });

  it('splits one kind by rarity and one rarity by kind', () => {
    const items = viewItems([
      rawOther('1', 'key_a', 4, { rarity: 3 }),
      rawOther('2', 'key_b', 4, { rarity: 4 }),
      rawGear({ id: '3', rarity: 3 }),
    ]);
    expect(deconstructGroups(items, labelOf).map((group) => group.id).sort()).toEqual(['equipment:3', 'key:3', 'key:4']);
  });

  it('keeps every piece of gear of one rarity together whatever its set, slot or forge', () => {
    const items = viewItems([
      rawGear({ id: '1', def_id: 'glacier_calca', set: 'glacier', rarity: 0 }),
      rawGear({ id: '2', def_id: 'ember_bota', set: 'ember', rarity: 0, upgrade: 6 }),
    ]);
    expect(deconstructGroups(items, () => 'Common Gear')).toEqual([{ id: 'equipment:0', label: 'Common Gear', count: 2 }]);
  });

  it('groups chests by the name they print, whatever their derived rarity', () => {
    const items = viewItems([
      rawOther('1', 'chest_item_80', 1, { rarity: 0 }),
      rawOther('2', 'chest_item_80', 1, { rarity: 1 }),
      rawOther('3', 'chest_item_90', 1),
      rawOther('4', 'chest_hero_5', 1),
      rawOther('5', 'chest_key_2', 1),
      rawOther('6', 'chest_key_3', 1),
    ]);
    const names: Record<string, string> = {
      chest_item_80: 'Item chest · Lv 80',
      chest_item_90: 'Item chest · Lv 90',
      chest_hero_5: 'Hero cage · Act 5',
      chest_key_2: 'Key chest',
      chest_key_3: 'Key chest',
    };
    const groups = deconstructGroups(items, (item) => names[item.defId] ?? item.defId);
    expect(groups.map((group) => `${group.label}:${String(group.count)}`)).toEqual([
      'Item chest · Lv 80:2',
      'Key chest:2',
      'Hero cage · Act 5:1',
      'Item chest · Lv 90:1',
    ]);
  });

  it('sorts by count descending, then by label, then by id', () => {
    const items = viewItems([
      rawOther('1', 'a', 4, { rarity: 1 }),
      rawOther('2', 'b', 4, { rarity: 2 }),
      rawOther('3', 'c', 4, { rarity: 3 }),
      rawOther('4', 'c', 4, { rarity: 3 }),
      rawOther('5', 'd', 2, { rarity: 1 }),
    ]);
    const names: Record<string, string> = { '1:key': 'Zeta', '2:key': 'Alpha', '3:key': 'Mid', '1:gem': 'Beta' };
    const groups = deconstructGroups(items, (item) => names[`${String(item.rarityIdx)}:${item.kind}`] ?? '?');
    expect(groups.map((group) => `${group.label}:${String(group.count)}`)).toEqual(['Mid:2', 'Alpha:1', 'Beta:1', 'Zeta:1']);
  });
});
