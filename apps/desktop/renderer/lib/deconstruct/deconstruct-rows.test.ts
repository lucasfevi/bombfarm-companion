import { describe, expect, it } from 'vitest';
import { deconstructLabels } from '../../app/deconstruct/deconstruct-labels';
import { en } from '../copy/en';
import {
  deconstructAccountKey,
  deconstructAnyInStash,
  deconstructCandidates,
  deconstructKinds,
  deconstructLevelBounds,
  deconstructOrder,
  deconstructRarities,
  deconstructSets,
  deconstructSlots,
  deconstructTableView,
  deconstructTopForge,
  EMPTY_DECONSTRUCT_FILTER,
  filterDeconstructItems,
  isEmptyDeconstructFilter,
  type DeconstructFilter,
} from './deconstruct-rows';
import { rawGear, rawOther, sampleBag, viewItems } from './test-items';

const labels = deconstructLabels(en, 'en', 'en');

function idsOf(filter: Partial<DeconstructFilter>, selected: readonly string[] = []): string[] {
  const candidates = deconstructCandidates(sampleBag());
  return filterDeconstructItems(candidates, { ...EMPTY_DECONSTRUCT_FILTER, ...filter }, labels.searchText, new Set(selected)).map(
    (item) => item.id,
  );
}

describe('deconstructCandidates', () => {
  it('lists everything the server would burn and leaves out what it prices at zero, such as a chest it gave no worth', () => {
    expect(deconstructCandidates(sampleBag()).map((item) => item.id)).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('lists a closed chest and a hero cage once the server gives them a worth', () => {
    const bag = viewItems([
      rawOther('c1', 'chest_item_10', 1, { rarity: 0, essence_value: 10 }),
      rawOther('c2', 'chest_hero_1', 1, { rarity: 0, essence_value: 10 }),
      rawOther('c3', 'skin_pack_1', 6, { rarity: 0, essence_value: 0 }),
    ]);
    expect(deconstructCandidates(bag).map((item) => item.id)).toEqual(['c1', 'c2']);
  });
});

describe('filterDeconstructItems', () => {
  it('opens on the burnable rows, hiding the worn piece the game would not let anyone tick', () => {
    expect(idsOf({})).toEqual(['1', '2', '3', '5', '6']);
  });

  it('shows the unburnable rows too once hiding them is switched off', () => {
    expect(idsOf({ hideUnburnable: false })).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('keeps a ticked row in view even when it is one the hide switch would drop', () => {
    expect(idsOf({}, ['4'])).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('narrows by kind, and by several kinds at once', () => {
    expect(idsOf({ kinds: ['gem'] })).toEqual(['5']);
    expect(idsOf({ kinds: ['gem', 'rune'] })).toEqual(['5', '6']);
  });

  it('narrows by rarity chips, several at once', () => {
    expect(idsOf({ rarities: [0] })).toEqual(['3', '6']);
    expect(idsOf({ rarities: [0, 3] })).toEqual(['2', '3', '6']);
  });

  it('narrows by set, where an emptied picker matches nothing and drops everything that is not gear', () => {
    expect(idsOf({ sets: ['ember'] })).toEqual(['3']);
    expect(idsOf({ sets: ['glacier', 'ember'] })).toEqual(['1', '2', '3']);
    expect(idsOf({ sets: [] })).toEqual([]);
  });

  it('narrows by slot', () => {
    expect(idsOf({ slot: 'bota' })).toEqual(['3']);
  });

  it('narrows by an inclusive item level range that only gear can satisfy', () => {
    expect(idsOf({ minLevel: 60 })).toEqual(['1', '2']);
    expect(idsOf({ maxLevel: 10 })).toEqual(['3']);
    expect(idsOf({ minLevel: 10, maxLevel: 60 })).toEqual(['1', '2', '3']);
  });

  it('hides forged pieces and leaves everything unforged, whatever its kind', () => {
    expect(idsOf({ hideForged: true })).toEqual(['1', '3', '5', '6']);
  });

  it('cuts the forge ladder at a ceiling that everything unforged already passes', () => {
    expect(idsOf({ maxForge: 4 })).toEqual(['1', '3', '5', '6']);
    expect(idsOf({ maxForge: 5 })).toEqual(['1', '2', '3', '5', '6']);
  });

  it('splits the bag from the stash on where the row sits', () => {
    expect(idsOf({ location: 'stash' })).toEqual(['3']);
    expect(idsOf({ location: 'bag' })).toEqual(['1', '2', '5', '6']);
    expect(idsOf({ location: 'any' })).toEqual(['1', '2', '3', '5', '6']);
  });

  it('matches free text against the localized name, case-insensitively and word by word', () => {
    expect(idsOf({ text: 'glacier boots' })).toEqual([]);
    expect(idsOf({ text: 'GLACIER' })).toEqual(['1', '2']);
    expect(idsOf({ text: 'ruby' })).toEqual(['5']);
    expect(idsOf({ text: '  ' })).toEqual(['1', '2', '3', '5', '6']);
  });

  it('shows only the ticked rows when asked to, which is how a batch is read back before burning', () => {
    expect(idsOf({ selectedOnly: true }, ['2', '5'])).toEqual(['2', '5']);
    expect(idsOf({ selectedOnly: true }, [])).toEqual([]);
  });

  it('combines every axis, a row having to pass all of them', () => {
    expect(idsOf({ sets: ['glacier'], rarities: [3], hideForged: true })).toEqual([]);
    expect(idsOf({ sets: ['glacier'], rarities: [3] })).toEqual(['2']);
  });
});

describe('isEmptyDeconstructFilter', () => {
  it('holds for the filter the page opens on, hiding the unburnable included', () => {
    expect(isEmptyDeconstructFilter(EMPTY_DECONSTRUCT_FILTER)).toBe(true);
  });

  it('breaks on every axis, including showing the rows the page hides by default', () => {
    const touched: Partial<DeconstructFilter>[] = [
      { text: 'a' },
      { kinds: ['gem'] },
      { rarities: [1] },
      { sets: [] },
      { slot: 'arma' },
      { minLevel: 1 },
      { maxLevel: 1 },
      { hideForged: true },
      { maxForge: 3 },
      { location: 'bag' },
      { hideUnburnable: false },
      { selectedOnly: true },
    ];
    for (const change of touched) {
      expect(isEmptyDeconstructFilter({ ...EMPTY_DECONSTRUCT_FILTER, ...change }), JSON.stringify(change)).toBe(false);
    }
  });

  it('treats a blank search box as no search', () => {
    expect(isEmptyDeconstructFilter({ ...EMPTY_DECONSTRUCT_FILTER, text: '   ' })).toBe(true);
  });
});

describe('the options the toolbar offers', () => {
  const candidates = deconstructCandidates(sampleBag());

  it('lists only the kinds present, in the inventory order', () => {
    expect(deconstructKinds(candidates)).toEqual(['equipment', 'gem', 'rune']);
  });

  it('lists only the rarities present, lowest first', () => {
    expect(deconstructRarities(candidates)).toEqual([0, 1, 2, 3]);
  });

  it('lists the sets of the gear with how many pieces each holds, lowest level first', () => {
    expect(deconstructSets(candidates)).toEqual([
      { set: 'ember', level: 10, count: 2 },
      { set: 'glacier', level: 60, count: 2 },
    ]);
  });

  it('lists the slots of the gear in the game order', () => {
    expect(deconstructSlots(candidates, ['arma', 'luva', 'bota', 'calca'])).toEqual(['arma', 'luva', 'bota', 'calca']);
  });

  it('bounds the level range by the gear present, and has none without gear', () => {
    expect(deconstructLevelBounds(candidates)).toEqual({ min: 10, max: 60 });
    expect(deconstructLevelBounds(candidates.filter((item) => item.kind !== 'equipment'))).toBeNull();
  });

  it('names the highest forge level present, and none when nothing is forged', () => {
    expect(deconstructTopForge(candidates)).toBe(5);
    expect(deconstructTopForge(candidates.filter((item) => item.upgrade === 0))).toBeNull();
  });

  it('knows whether anything sits in the stash', () => {
    expect(deconstructAnyInStash(candidates)).toBe(true);
    expect(deconstructAnyInStash(candidates.filter((item) => !item.inStash))).toBe(false);
  });
});

describe('the table view', () => {
  it('gives every item its own row in one flat group, where the shared view would stack identical gems', () => {
    const items = viewItems([
      { id: 'a', def_id: 'gem_ruby', category: 2, rarity: 1, essence_value: 5 },
      { id: 'b', def_id: 'gem_ruby', category: 2, rarity: 1, essence_value: 5 },
    ]);
    const view = deconstructTableView(items);
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0]?.entries.map((entry) => [entry.key, entry.count])).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
  });

  it('orders the whole list by the sort given — level first, rarity among equals — as the table will show it', () => {
    const items = viewItems([
      rawGear({ id: 'low', level: 10, rarity: 3 }),
      rawGear({ id: 'mid', level: 60, rarity: 1 }),
      rawGear({ id: 'top', level: 60, rarity: 3 }),
    ]);
    const order = deconstructOrder(
      items,
      [
        { key: 'level', direction: 'desc' },
        { key: 'rarity', direction: 'desc' },
      ],
      labels.itemName,
    );
    expect(order.map((item) => item.id)).toEqual(['top', 'mid', 'low']);
  });

  it('lays the essence order over the sort, keeping the sort as the tie-break, and counts an unknown figure as nothing', () => {
    const items = viewItems([
      rawGear({ id: 'a', level: 10, essence_value: 50 }),
      rawGear({ id: 'b', level: 60, essence_value: 50 }),
      rawGear({ id: 'c', level: 30, essence_value: 200 }),
      rawGear({ id: 'd', level: 40, essence_value: undefined }),
    ]);
    const byLevel = [{ key: 'level', direction: 'desc' }] as const;
    const ids = (direction: 'asc' | 'desc' | null) =>
      deconstructOrder(items, byLevel, labels.itemName, direction).map((item) => item.id);

    expect(ids(null)).toEqual(['b', 'd', 'c', 'a']);
    expect(ids('desc')).toEqual(['c', 'b', 'a', 'd']);
    expect(ids('asc')).toEqual(['d', 'b', 'a', 'c']);
  });
});

describe('deconstructAccountKey', () => {
  it('reads the account id as text, whether the read carries a number or a string', () => {
    expect(deconstructAccountKey({ account_id: 486 })).toBe('486');
    expect(deconstructAccountKey({ account_id: ' 486 ' })).toBe('486');
  });

  it('is null when the read names no account', () => {
    expect(deconstructAccountKey(undefined)).toBeNull();
    expect(deconstructAccountKey({ gold: 5 })).toBeNull();
    expect(deconstructAccountKey({ account_id: '' })).toBeNull();
    expect(deconstructAccountKey({ account_id: Number.NaN })).toBeNull();
  });
});
