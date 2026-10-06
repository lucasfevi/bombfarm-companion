import { describe, expect, it } from 'vitest';
import {
  fillDeconstruct,
  pruneDeconstructSelection,
  selectedDeconstructItems,
  selectShownDeconstruct,
  shownAddable,
  toggleDeconstructSelection,
  withoutDeconstructIds,
} from './deconstruct-selection';
import { rawGear, rawOther, viewItems } from './test-items';

const CAP = 3;

describe('toggleDeconstructSelection', () => {
  it('adds an id at the end, keeping the order the player ticked in', () => {
    expect(toggleDeconstructSelection(['a'], 'b', CAP)).toEqual({ ids: ['a', 'b'], refused: false });
  });

  it('removes an id that is already ticked', () => {
    expect(toggleDeconstructSelection(['a', 'b'], 'a', CAP)).toEqual({ ids: ['b'], refused: false });
  });

  it('refuses one more than the cap and says so, leaving the batch as it was', () => {
    const full = ['a', 'b', 'c'];
    const change = toggleDeconstructSelection(full, 'd', CAP);
    expect(change.refused).toBe(true);
    expect(change.ids).toBe(full);
  });

  it('still lets a full batch shed an id', () => {
    expect(toggleDeconstructSelection(['a', 'b', 'c'], 'b', CAP)).toEqual({ ids: ['a', 'c'], refused: false });
  });
});

describe('selectShownDeconstruct', () => {
  const shown = viewItems([
    rawGear({ id: 'a' }),
    rawGear({ id: 'worn', equipped_on: 'h1' }),
    rawGear({ id: 'b' }),
    rawGear({ id: 'c' }),
    rawGear({ id: 'd' }),
  ]);

  it('ticks every burnable row in the order given, skipping the ones that cannot be burned', () => {
    const change = selectShownDeconstruct(shown, [], 10);
    expect(change.ids).toEqual(['a', 'b', 'c', 'd']);
    expect(change).toMatchObject({ added: 4, overflow: 0 });
  });

  it('stops at the cap and reports how many qualifying rows did not fit', () => {
    const change = selectShownDeconstruct(shown, [], CAP);
    expect(change.ids).toEqual(['a', 'b', 'c']);
    expect(change).toMatchObject({ added: 3, overflow: 1 });
  });

  it('counts only the room that is left, and does not tick a row twice', () => {
    const change = selectShownDeconstruct(shown, ['b'], CAP);
    expect(change.ids).toEqual(['b', 'a', 'c']);
    expect(change).toMatchObject({ added: 2, overflow: 1 });
  });

  it('hands back the same array when nothing could be added', () => {
    const full = ['x', 'y', 'z'];
    const change = selectShownDeconstruct(shown, full, CAP);
    expect(change.ids).toBe(full);
    expect(change).toMatchObject({ added: 0, overflow: 4 });
  });
});

describe('shownAddable', () => {
  const rows = viewItems([rawGear({ id: 'a' }), rawGear({ id: 'worn', equipped_on: 'h1' }), rawGear({ id: 'b' }), rawGear({ id: 'c' })]);

  it('counts the burnable shown rows the batch does not hold yet', () => {
    expect(shownAddable(rows, ['b'])).toEqual({ burnable: 3, addable: 2 });
  });

  it('says nothing can be added once every burnable row is in the batch, without calling them unburnable', () => {
    expect(shownAddable(rows, ['a', 'b', 'c'])).toEqual({ burnable: 3, addable: 0 });
  });

  it('counts nothing for a list of rows that cannot be burned', () => {
    expect(shownAddable(rows.filter((row) => row.id === 'worn'), [])).toEqual({ burnable: 0, addable: 0 });
  });
});

describe('fillDeconstruct', () => {
  const rows = viewItems([
    rawGear({ id: 'common-high', rarity: 0, level: 60 }),
    rawGear({ id: 'common-low', rarity: 0, level: 10 }),
    rawGear({ id: 'uncommon', rarity: 1, level: 10 }),
    rawGear({ id: 'rare', rarity: 2, level: 1 }),
    rawGear({ id: 'epic', rarity: 3, level: 1 }),
  ]);

  it('picks Common and Uncommon only, the cheapest first', () => {
    expect(fillDeconstruct(rows, [], 10).ids).toEqual(['common-low', 'common-high', 'uncommon']);
  });

  it('leaves a chest and a hero cage for the player to tick, though both are burnable', () => {
    const withChests = viewItems([
      rawGear({ id: 'gear', rarity: 0, level: 10 }),
      rawOther('chest', 'chest_item_10', 1, { rarity: 0, essence_value: 10 }),
      rawOther('cage', 'chest_hero_1', 1, { rarity: 0, essence_value: 10 }),
    ]);
    expect(fillDeconstruct(withChests, [], 10).ids).toEqual(['gear']);
    expect(selectShownDeconstruct(withChests, [], 10).ids).toEqual(['gear', 'chest', 'cage']);
  });

  it('stops at the cap, counting what is already ticked', () => {
    expect(fillDeconstruct(rows, ['rare'], 3).ids).toEqual(['rare', 'common-low', 'common-high']);
  });

  it('draws only from the rows it is handed, which is how an active filter narrows it', () => {
    const shown = rows.filter((item) => item.id !== 'common-low');
    expect(fillDeconstruct(shown, [], 10).ids).toEqual(['common-high', 'uncommon']);
  });

  it('adds nothing when no shown row qualifies, and says so by handing back the same array', () => {
    const ticked = ['rare'];
    const change = fillDeconstruct(rows.filter((item) => item.rarityIdx >= 2), ticked, 10);
    expect(change.ids).toBe(ticked);
    expect(change.added).toBe(0);
  });
});

describe('pruneDeconstructSelection', () => {
  it('drops an id the bag no longer holds', () => {
    const bag = viewItems([rawGear({ id: 'a' })]);
    expect(pruneDeconstructSelection(['a', 'gone'], bag)).toEqual(['a']);
  });

  it('drops an id that became unburnable since it was ticked', () => {
    const bag = viewItems([rawGear({ id: 'a' }), rawGear({ id: 'b', equipped_on: 'h1' })]);
    expect(pruneDeconstructSelection(['a', 'b'], bag)).toEqual(['a']);
  });

  it('hands back the same array when every id still stands, so a store can skip the write', () => {
    const bag = viewItems([rawGear({ id: 'a' })]);
    const ids = ['a'];
    expect(pruneDeconstructSelection(ids, bag)).toBe(ids);
    const none: string[] = [];
    expect(pruneDeconstructSelection(none, bag)).toBe(none);
  });
});

describe('selectedDeconstructItems', () => {
  it('returns the ticked items in the order they were ticked and skips an id with no item', () => {
    const bag = viewItems([rawGear({ id: 'a' }), rawGear({ id: 'b' })]);
    expect(selectedDeconstructItems(['b', 'gone', 'a'], bag).map((item) => item.id)).toEqual(['b', 'a']);
  });
});

describe('withoutDeconstructIds', () => {
  it('removes the burned ids and keeps the rest in order', () => {
    expect(withoutDeconstructIds(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });

  it('hands back the same array when none of the ids were ticked', () => {
    const ids = ['a'];
    expect(withoutDeconstructIds(ids, ['z'])).toBe(ids);
    expect(withoutDeconstructIds(ids, [])).toBe(ids);
  });
});
