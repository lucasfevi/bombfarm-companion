import { describe, expect, it } from 'vitest';
import {
  COLLECTION_AXES,
  type CollectionEffectState,
  type CollectionPieceState,
  type CollectionSetState,
  type CollectionsSnapshot,
} from '@bombfarm/contracts';
import {
  buildCollectionBoard,
  collectionBagItemsFromInventory,
  collectionCents,
  collectionPageGrantCents,
  collectionPageIncrementsCents,
  type CollectionBagItem,
} from '../src/collection-board';

const GOLD_PAGES = [3.3, 6.5, 9.8, 14.6, 19.5, 26];
const SLOTS = ['arma', 'elmo', 'peito', 'calca', 'bota', 'luva', 'anel', 'amuleto'];

function effect(axis: CollectionEffectState['axis'], pageValues: readonly number[], now: number): CollectionEffectState {
  return { axis, pageValues, now };
}

function pieces(set: string, level: number, masks: readonly number[]): CollectionPieceState[] {
  return masks.map((sacrificedMask, slot) => ({
    defId: `${set}_${SLOTS[slot] ?? 'x'}`,
    set,
    slot,
    level,
    sacrificedMask,
    pendingMask: 0,
  }));
}

function countsFromMasks(masks: readonly number[]): number[] {
  return Array.from({ length: 6 }, (_, rarity) => masks.filter((mask) => Math.floor(mask / 2 ** rarity) % 2 === 1).length);
}

/** Pages 0 and 1 hold all eight pieces; page 2 holds five (slots 0 to 4). */
const GOLD_MASKS = [7, 7, 7, 7, 7, 3, 3, 3];

function goldSet(masks: readonly number[] = GOLD_MASKS): CollectionSetState {
  return {
    code: 'gold',
    level: 20,
    piecesByPage: countsFromMasks(masks),
    effects: [effect('gold', GOLD_PAGES, 7.74)],
  };
}

function snapshotOf(sets: readonly CollectionSetState[], piecesList: readonly CollectionPieceState[], overrides: Partial<CollectionsSnapshot> = {}): CollectionsSnapshot {
  const zero = Object.fromEntries(COLLECTION_AXES.map((axis) => [axis, 0])) as CollectionsSnapshot['caps'];
  return { partialPct: 60, caps: zero, totals: zero, raw: zero, sets, pieces: piecesList, ...overrides };
}

function goldSnapshot(masks: readonly number[] = GOLD_MASKS): CollectionsSnapshot {
  return snapshotOf([goldSet(masks)], pieces('gold', 20, masks));
}

function free(defId: string, rarity: number): CollectionBagItem {
  return { defId, rarity, free: true };
}

function goldBoard(bag: readonly CollectionBagItem[], masks: readonly number[] = GOLD_MASKS) {
  const set = buildCollectionBoard(goldSnapshot(masks), bag).sets[0];
  if (set === undefined) throw new Error('the board has no set');
  return set;
}

describe('collectionPageIncrementsCents', () => {
  it('turns cumulative page values into what each page adds, in whole hundredths', () => {
    expect(collectionPageIncrementsCents(GOLD_PAGES)).toEqual([330, 320, 330, 480, 490, 650]);
  });
});

describe('collectionPageGrantCents', () => {
  it('grants a complete page its whole increment', () => {
    expect(collectionPageGrantCents(330, 8, 60)).toBe(330);
  });

  it('grants an empty page nothing', () => {
    expect(collectionPageGrantCents(330, 0, 60)).toBe(0);
  });

  it('grants a partial page its increment times the partial share times k over eight', () => {
    expect(collectionPageGrantCents(330, 5, 60)).toBe(124);
  });

  it('rounds half up', () => {
    expect(collectionPageGrantCents(5, 4, 60)).toBe(2);
    expect(collectionPageGrantCents(5, 3, 60)).toBe(1);
  });
});

describe('collectionBagItemsFromInventory', () => {
  const wire = (overrides: Record<string, unknown>) => ({
    def_id: 'gold_luva',
    rarity: 2,
    equipped_on: null,
    locked: false,
    market_state: 0,
    in_stash: false,
    ...overrides,
  });

  it('marks an item that is not equipped, locked, listed or stashed as free', () => {
    expect(collectionBagItemsFromInventory([wire({})])).toEqual([{ defId: 'gold_luva', rarity: 2, free: true }]);
  });

  it.each([
    ['equipped', { equipped_on: '555' }],
    ['locked', { locked: true }],
    ['listed on the market', { market_state: 1 }],
    ['in the stash', { in_stash: true }],
  ])('marks an item that is %s as not free', (_name, overrides) => {
    expect(collectionBagItemsFromInventory([wire(overrides)])).toEqual([{ defId: 'gold_luva', rarity: 2, free: false }]);
  });

  it('skips entries that are not items and reads anything that is not a list as an empty bag', () => {
    expect(collectionBagItemsFromInventory([null, 4, { def_id: 7, rarity: 1 }, { def_id: 'x' }])).toEqual([]);
    expect(collectionBagItemsFromInventory({ items: [] })).toEqual([]);
    expect(collectionBagItemsFromInventory(undefined)).toEqual([]);
  });
});

describe('buildCollectionBoard: a set with no bag', () => {
  it('rebuilds the effect from its pages to the figure the server states', () => {
    const set = goldBoard([]);
    expect(set.pages.map((page) => page.effects[0]?.granted)).toEqual([3.3, 3.2, 1.24, 0, 0, 0]);
    expect(set.effects[0]?.now).toBe(7.74);
  });

  it('gives each page its increment as the full value', () => {
    expect(goldBoard([]).pages.map((page) => page.effects[0]?.full)).toEqual([3.3, 3.2, 3.3, 4.8, 4.9, 6.5]);
  });

  it('reports the maximum, and what is left to earn', () => {
    expect(goldBoard([]).effects[0]).toMatchObject({ max: 26, now: 7.74, remaining: 18.26, readyGain: 0 });
  });

  it('never reports a negative remainder when the server is ahead of the table', () => {
    const snapshot = snapshotOf([{ ...goldSet(), effects: [effect('gold', GOLD_PAGES, 26.01)] }], []);
    expect(buildCollectionBoard(snapshot).sets[0]?.effects[0]?.remaining).toBe(0);
  });

  it('counts the pieces on each page and flags the complete ones', () => {
    const pages = goldBoard([]).pages;
    expect(pages.map((page) => page.pieces)).toEqual([8, 8, 5, 0, 0, 0]);
    expect(pages.map((page) => page.complete)).toEqual([true, true, false, false, false, false]);
  });

  it('totals forty-eight pieces to a set and counts the sacrificed ones', () => {
    expect(goldBoard([])).toMatchObject({ piecesTotal: 48, piecesSacrificed: 21, status: 'started', readyInBag: 0 });
  });

  it('builds a set whose pieces are missing from the piece list', () => {
    const board = buildCollectionBoard(snapshotOf([goldSet()], []));
    expect(board.sets[0]).toMatchObject({ pieces: [], piecesSacrificed: 21, readyInBag: 0 });
    expect(board.sets[0]?.pages.map((page) => page.pieces)).toEqual([8, 8, 5, 0, 0, 0]);
  });

  it('marks each piece with the pages it is sacrificed on', () => {
    const luva = goldBoard([]).pieces.find((piece) => piece.slot === 5);
    expect(luva?.sacrificed).toEqual([true, true, false, false, false, false]);
    expect(luva?.defId).toBe('gold_luva');
  });

  it('carries each piece’s own level, even when it differs from its set’s', () => {
    const snapshot = goldSnapshot();
    const reLevelled = snapshot.pieces.map((piece) => (piece.slot === 1 ? { ...piece, level: 25 } : piece));
    const row = buildCollectionBoard({ ...snapshot, pieces: reLevelled }).sets[0];
    expect(row?.level).toBe(20);
    expect(row?.pieces.map((piece) => piece.level)).toEqual([20, 25, 20, 20, 20, 20, 20, 20]);
  });

  it('lists the pieces by slot', () => {
    expect(goldBoard([]).pieces.map((piece) => piece.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('buildCollectionBoard: set status', () => {
  const allIn = [63, 63, 63, 63, 63, 63, 63, 63];
  const none = [0, 0, 0, 0, 0, 0, 0, 0];

  it('calls a set with every page full complete', () => {
    expect(goldBoard([], allIn).status).toBe('complete');
  });

  it('calls a set with no pieces sacrificed empty', () => {
    expect(goldBoard([], none).status).toBe('empty');
  });

  it('calls a set with some pieces sacrificed started', () => {
    expect(goldBoard([], [1, 0, 0, 0, 0, 0, 0, 0]).status).toBe('started');
  });

  it('orders the sets by level and counts the books started and complete', () => {
    const high: CollectionSetState = { ...goldSet(allIn), code: 'high', level: 90 };
    const low: CollectionSetState = { ...goldSet(none), code: 'low', level: 10 };
    const board = buildCollectionBoard(snapshotOf([high, goldSet(), low], []));
    expect(board.sets.map((set) => set.code)).toEqual(['low', 'gold', 'high']);
    expect(board.summary).toEqual({
      booksStarted: 2,
      booksComplete: 1,
      booksTotal: 3,
      piecesSacrificed: 48 + 21,
      piecesTotal: 144,
      readyInBag: 0,
    });
  });
});

describe('buildCollectionBoard: pieces ready in the bag', () => {
  it('marks exactly the one open slot a free exact-rarity item fills', () => {
    const set = goldBoard([free('gold_luva', 2)]);
    const marked = set.pieces.flatMap((piece) => piece.ready.map((ready, rarity) => ({ slot: piece.slot, rarity, ready }))).filter((cell) => cell.ready);
    expect(marked).toEqual([{ slot: 5, rarity: 2, ready: true }]);
    expect(set.pages[2]?.ready).toBe(1);
    expect(set.readyInBag).toBe(1);
  });

  it('moves the page by the partial-page formula when the ready piece is sacrificed too', () => {
    const page = goldBoard([free('gold_luva', 2)]).pages[2]?.effects[0];
    expect(page).toMatchObject({ full: 3.3, granted: 1.24, withReady: 1.49 });
  });

  it('reports the gain across the book from every ready piece', () => {
    const set = goldBoard([free('gold_luva', 2), free('gold_arma', 3)]);
    expect(set.effects[0]?.readyGain).toBe(0.61);
  });

  it('fills a slot once however many free copies the bag holds', () => {
    const set = goldBoard([free('gold_luva', 2), free('gold_luva', 2), free('gold_luva', 2)]);
    expect(set.pages[2]?.ready).toBe(1);
  });

  it('ignores an item the bag cannot spare', () => {
    const items = collectionBagItemsFromInventory([
      { def_id: 'gold_luva', rarity: 2, equipped_on: '555', locked: false, market_state: 0, in_stash: false },
      { def_id: 'gold_luva', rarity: 2, equipped_on: null, locked: true, market_state: 0, in_stash: false },
      { def_id: 'gold_luva', rarity: 2, equipped_on: null, locked: false, market_state: 1, in_stash: false },
      { def_id: 'gold_luva', rarity: 2, equipped_on: null, locked: false, market_state: 0, in_stash: true },
    ]);
    expect(items).toHaveLength(4);
    expect(goldBoard(items).readyInBag).toBe(0);
  });

  it('does not let a higher-rarity item stand in on a lower page', () => {
    const set = goldBoard([free('gold_luva', 3)]);
    expect(set.pieces.find((piece) => piece.slot === 5)?.ready).toEqual([false, false, false, true, false, false]);
    expect(set.pages[2]?.ready).toBe(0);
  });

  it('never marks a slot that is already sacrificed on that page', () => {
    expect(goldBoard([free('gold_arma', 0), free('gold_arma', 2)]).readyInBag).toBe(0);
  });

  it('never marks a slot whose sacrifice is still arriving', () => {
    const snapshot = goldSnapshot();
    const pending = snapshot.pieces.map((piece) => (piece.slot === 5 ? { ...piece, pendingMask: 4 } : piece));
    const board = buildCollectionBoard({ ...snapshot, pieces: pending }, [free('gold_luva', 2)]);
    expect(board.sets[0]?.readyInBag).toBe(0);
  });

  it('counts a ready piece toward the summary', () => {
    const board = buildCollectionBoard(goldSnapshot(), [free('gold_luva', 2), free('gold_anel', 2)]);
    expect(board.summary.readyInBag).toBe(2);
  });
});

describe('buildCollectionBoard: axes', () => {
  const damageOver: CollectionSetState = {
    code: 'a',
    level: 10,
    piecesByPage: [8, 8, 8, 8, 8, 8],
    effects: [effect('damage', [1.6, 3.2, 4.8, 7.2, 9.6, 12.8], 12.8)],
  };
  const damageToo: CollectionSetState = {
    code: 'b',
    level: 20,
    piecesByPage: [8, 8, 8, 8, 8, 8],
    effects: [effect('damage', [20, 40, 60, 70, 80, 90], 90), effect('gold', GOLD_PAGES, 26)],
  };
  const snapshot = snapshotOf([damageOver, damageToo], [], {
    caps: { ...snapshotOf([], []).caps, damage: 30, gold: 60 },
    raw: { ...snapshotOf([], []).raw, damage: 102.8, gold: 26 },
    totals: { ...snapshotOf([], []).totals, damage: 30, gold: 26 },
  });
  const rows = buildCollectionBoard(snapshot).axes;

  it('lists the ten axes in the game panel order', () => {
    expect(rows.map((row) => row.axis)).toEqual([...COLLECTION_AXES]);
  });

  it('reports the server total, the uncapped sum and the cap', () => {
    expect(rows.find((row) => row.axis === 'damage')).toMatchObject({ total: 30, raw: 102.8, cap: 30, atCap: true });
  });

  it('sums every book maximum on an axis, which can exceed the cap', () => {
    expect(rows.find((row) => row.axis === 'damage')).toMatchObject({ maxRaw: 102.8, books: 2 });
    expect(rows.find((row) => row.axis === 'gold')).toMatchObject({ maxRaw: 26, books: 1, atCap: false });
  });

  it('names the sets that grant each axis, lowest level first, however the snapshot lists them', () => {
    const triple: CollectionSetState = {
      code: 'c',
      level: 5,
      piecesByPage: [0, 0, 0, 0, 0, 0],
      effects: [effect('damage', GOLD_PAGES, 0), effect('critDamage', GOLD_PAGES, 0), effect('cooldown', GOLD_PAGES, 0)],
    };
    const shuffled = buildCollectionBoard({ ...snapshot, sets: [damageToo, triple, damageOver] }).axes;
    const codesOf = (axis: string) => shuffled.find((row) => row.axis === axis)?.setCodes;
    expect(codesOf('damage')).toEqual(['c', 'a', 'b']);
    expect(codesOf('gold')).toEqual(['b']);
    expect(codesOf('critDamage')).toEqual(['c']);
    expect(codesOf('cooldown')).toEqual(['c']);
    expect(codesOf('luck')).toEqual([]);
  });

  it('counts a three-effect book once under each of its three axes, and keeps books equal to the list’s length', () => {
    const triple: CollectionSetState = {
      code: 'c',
      level: 5,
      piecesByPage: [0, 0, 0, 0, 0, 0],
      effects: [effect('damage', GOLD_PAGES, 0), effect('critDamage', GOLD_PAGES, 0), effect('cooldown', GOLD_PAGES, 0)],
    };
    const axes = buildCollectionBoard({ ...snapshot, sets: [damageOver, damageToo, triple] }).axes;
    expect(axes.filter((row) => row.setCodes.includes('c')).map((row) => row.axis)).toEqual(['damage', 'critDamage', 'cooldown']);
    for (const row of axes) expect(row.books).toBe(row.setCodes.length);
  });

  it('never calls an axis with no cap at its cap', () => {
    expect(rows.find((row) => row.axis === 'luck')).toMatchObject({ cap: 0, atCap: false, books: 0, maxRaw: 0 });
  });
});

describe('buildCollectionBoard: properties', () => {
  function lcg(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  it('keeps granted at or below withReady, and withReady at or below full, on every page of random books', () => {
    const next = lcg(7);
    for (let trial = 0; trial < 60; trial += 1) {
      const masks = SLOTS.map(() => Math.floor(next() * 64));
      const bag = SLOTS.flatMap((slot) =>
        Array.from({ length: 6 }, (_, rarity) => rarity).filter(() => next() < 0.4).map((rarity) => free(`gold_${slot}`, rarity)),
      );
      const set = goldBoard(bag, masks);
      for (const page of set.pages) {
        for (const row of page.effects) {
          expect(row.granted).toBeLessThanOrEqual(row.withReady);
          expect(row.withReady).toBeLessThanOrEqual(row.full);
        }
      }
    }
  });

  it('grants each page its increment times the partial share times k over eight, rounded half up, for any pieces per page', () => {
    const next = lcg(11);
    const cumulativeCents = [330, 650, 980, 1460, 1950, 2600];
    for (let trial = 0; trial < 60; trial += 1) {
      const partialPct = 10 + Math.floor(next() * 90);
      const perPage = Array.from({ length: 6 }, () => Math.floor(next() * 9));
      let expected = 0;
      cumulativeCents.forEach((cumulative, rarity) => {
        const increment = cumulative - (cumulativeCents[rarity - 1] ?? 0);
        const held = perPage[rarity] ?? 0;
        expected += held === 8 ? increment : Math.floor((increment * partialPct * held + 400) / 800);
      });
      const snapshot = snapshotOf([{ ...goldSet(), piecesByPage: perPage }], [], { partialPct });
      const set = buildCollectionBoard(snapshot).sets[0];
      const fromPages = set?.pages.reduce((total, page) => total + Math.round((page.effects[0]?.granted ?? 0) * 100), 0);
      expect(fromPages).toBe(expected);
    }
  });
});

describe('buildCollectionBoard: bodies that disagree with themselves', () => {
  const wire = (overrides: Record<string, unknown>) => ({
    def_id: 'gold_luva',
    rarity: 2,
    equipped_on: null,
    locked: false,
    market_state: 0,
    in_stash: false,
    ...overrides,
  });

  it.each([
    ['an empty equipped_on', { equipped_on: '' }],
    ['a non-string equipped_on', { equipped_on: 42 }],
    ['a null market_state', { market_state: null }],
    ['a market_state spelled "0"', { market_state: '0' }],
    ['a market_state that is not a number', { market_state: 'soon' }],
  ])('still reads an item with %s as free, the way the inventory readers do', (_name, overrides) => {
    const bag = collectionBagItemsFromInventory([wire(overrides)]);
    expect(bag[0]?.free).toBe(true);
    expect(goldBoard(bag).readyInBag).toBe(1);
  });

  it.each([
    ['an equipped_on naming a hero', { equipped_on: '555' }],
    ['a market_state spelled "1"', { market_state: '1' }],
    ['a market_state of 2', { market_state: 2 }],
  ])('reads an item with %s as not free', (_name, overrides) => {
    expect(collectionBagItemsFromInventory([wire(overrides)])[0]?.free).toBe(false);
  });

  it('calls a set with no per-page counts empty, not complete', () => {
    const board = buildCollectionBoard(snapshotOf([{ ...goldSet(), piecesByPage: [] }], []));
    expect(board.sets[0]?.status).toBe('empty');
    expect(board.summary.booksComplete).toBe(0);
  });

  it('calls a set with only three per-page counts, all full, started rather than complete', () => {
    const board = buildCollectionBoard(snapshotOf([{ ...goldSet(), piecesByPage: [8, 8, 8] }], []));
    expect(board.sets[0]?.status).toBe('started');
  });

  it('reports no ready piece on a page the counts say is full, though a mask bit is clear and the bag holds the item', () => {
    const snapshot = snapshotOf([{ ...goldSet(), piecesByPage: [8, 8, 8, 0, 0, 0] }], pieces('gold', 20, GOLD_MASKS));
    const set = buildCollectionBoard(snapshot, [free('gold_luva', 2)]).sets[0];
    expect(set?.pages[2]).toMatchObject({ pieces: 8, complete: true, ready: 0 });
    expect(set?.pieces.find((piece) => piece.slot === 5)?.ready[2]).toBe(false);
    expect(set?.readyInBag).toBe(0);
    expect(set?.pages[2]?.effects[0]).toMatchObject({ full: 3.3, granted: 3.3, withReady: 3.3 });
  });

  it('never lets a page gain past its full increment when the counts and masks disagree on a partial page', () => {
    const snapshot = snapshotOf([{ ...goldSet(), piecesByPage: [8, 8, 7, 0, 0, 0] }], pieces('gold', 20, GOLD_MASKS));
    const bag = [free('gold_luva', 2), free('gold_anel', 2), free('gold_amuleto', 2)];
    const page = buildCollectionBoard(snapshot, bag).sets[0]?.pages[2];
    expect(page?.ready).toBe(3);
    expect(page?.effects[0]).toMatchObject({ full: 3.3, granted: 1.73, withReady: 3.3 });
  });
});

describe('buildCollectionBoard: piece rows', () => {
  it('lists pieces by slot however the server ordered them', () => {
    const reversed = [...pieces('gold', 20, GOLD_MASKS)].reverse();
    const board = buildCollectionBoard(snapshotOf([goldSet()], reversed));
    expect(board.sets[0]?.pieces.map((piece) => piece.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('marks one piece ready on two pages at once, and both pages gain', () => {
    const set = goldBoard([free('gold_luva', 2), free('gold_luva', 3)]);
    expect(set.pieces.find((piece) => piece.slot === 5)?.ready).toEqual([false, false, true, true, false, false]);
    expect(set.pages[2]?.effects[0]).toMatchObject({ granted: 1.24, withReady: 1.49 });
    expect(set.pages[3]?.effects[0]).toMatchObject({ granted: 0, withReady: 0.36 });
    expect(set.readyInBag).toBe(2);
  });

  it('keeps sacrificed and pending bits apart on one piece and offers only the page that is neither', () => {
    const snapshot = goldSnapshot();
    const mixed = snapshot.pieces.map((piece) => (piece.slot === 5 ? { ...piece, sacrificedMask: 3, pendingMask: 4 } : piece));
    const bag = [free('gold_luva', 1), free('gold_luva', 2), free('gold_luva', 3)];
    const row = buildCollectionBoard({ ...snapshot, pieces: mixed }, bag).sets[0]?.pieces.find((piece) => piece.slot === 5);
    expect(row?.sacrificed).toEqual([true, true, false, false, false, false]);
    expect(row?.pending).toEqual([false, false, true, false, false, false]);
    expect(row?.ready).toEqual([false, false, false, true, false, false]);
  });
});

describe('buildCollectionBoard: figures the server sends', () => {
  const zero = snapshotOf([], []).caps;

  it('calls an axis at its cap when the uncapped sum equals the cap exactly', () => {
    const snapshot = snapshotOf([], [], { caps: { ...zero, damage: 30 }, raw: { ...zero, damage: 30 } });
    expect(buildCollectionBoard(snapshot).axes[0]?.atCap).toBe(true);
  });

  it('does not call an axis with a cap of zero at its cap, whatever its sum', () => {
    const snapshot = snapshotOf([], [], { raw: { ...zero, damage: 5 } });
    expect(buildCollectionBoard(snapshot).axes[0]?.atCap).toBe(false);
  });

  it('leaves the snapshot it was given untouched', () => {
    const deepFreeze = <T>(value: T): T => {
      if (typeof value === 'object' && value !== null) {
        Object.values(value).forEach(deepFreeze);
        Object.freeze(value);
      }
      return value;
    };
    const frozen = deepFreeze(goldSnapshot());
    const bag = deepFreeze([free('gold_luva', 2)]);
    expect(buildCollectionBoard(frozen, bag)).toEqual(buildCollectionBoard(goldSnapshot(), [free('gold_luva', 2)]));
  });

  it('rounds every percent it reports to hundredths when the server sends float dust', () => {
    const dust = 0.1 + 0.2;
    const set: CollectionSetState = {
      code: 'dusty',
      level: 10,
      piecesByPage: [8, 0, 0, 0, 0, 0],
      effects: [effect('gold', [1, 2, 3, 4, 5, 26 + 4.4e-15], dust)],
    };
    const snapshot = snapshotOf([set], [], {
      caps: { ...zero, gold: dust },
      raw: { ...zero, gold: dust },
      totals: { ...zero, gold: dust },
    });
    const board = buildCollectionBoard(snapshot);
    const gold = board.axes.find((row) => row.axis === 'gold');
    expect(gold).toMatchObject({ total: 0.3, raw: 0.3, cap: 0.3, maxRaw: 26 });
    expect(board.sets[0]?.effects[0]).toMatchObject({ now: 0.3, max: 26, remaining: 25.7 });
  });
});

describe('completedRarity', () => {
  const rarityFor = (masks: readonly number[]) => buildCollectionBoard(goldSnapshot(masks)).sets[0]?.completedRarity;

  it('is the highest page that is complete with every page below it', () => {
    expect(rarityFor(GOLD_MASKS)).toBe(1);
    expect(rarityFor([15, 15, 15, 15, 15, 15, 15, 15])).toBe(3);
    expect(rarityFor([63, 63, 63, 63, 63, 63, 63, 63])).toBe(5);
  });

  it('stops at the first unfinished page even when a higher page is full', () => {
    expect(rarityFor([5, 5, 5, 5, 5, 5, 5, 5])).toBe(0);
  });

  it('is null while the common page is unfinished', () => {
    expect(rarityFor([2, 2, 2, 2, 2, 2, 2, 2])).toBeNull();
    expect(rarityFor([1, 1, 1, 1, 1, 1, 1, 0])).toBeNull();
  });
});
