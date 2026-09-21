import { describe, expect, it } from 'vitest';
import {
  deriveEquipUnits,
  liveGearStateFromRows,
  preflightEquipUnits,
  summarizeApplyVerdicts,
  type LiveGearState,
} from '@bombfarm/domain/team-plan';
import type { MoveAction } from '@bombfarm/domain/team-plan';
import type { ApplyEquipUnit, ApplyUnitVerdict } from '@bombfarm/contracts';

const SLOT = 'weapon';

function unequip(itemId: string, fromHeroId: string, defId = `def-${itemId}`): MoveAction {
  return { phase: 'unequip', itemId, defId, slot: SLOT, fromHeroId, toHeroId: null };
}

function equip(itemId: string, fromHeroId: string | null, toHeroId: string, defId = `def-${itemId}`): MoveAction {
  return { phase: 'equip', itemId, defId, slot: SLOT, fromHeroId, toHeroId };
}

describe('deriveEquipUnits — the one-call example', () => {
  it('a piece equipped straight from the bag onto a hero displaces a piece bound for the bag, in one unit', () => {
    const moveList: MoveAction[] = [unequip('Y', 'hero-b'), equip('X', null, 'hero-b')];
    const units = deriveEquipUnits(moveList);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      call: 'equip',
      itemId: 'X',
      toHeroId: 'hero-b',
      displacesItemId: 'Y',
      freedByIndex: null,
      pendingAt: [null],
      doneAt: ['hero-b'],
    });
  });
});

describe('deriveEquipUnits — freedByIndex / pendingAt / doneAt', () => {
  it('a bag-start piece carries freedByIndex null and pendingAt [null]', () => {
    const units = deriveEquipUnits([equip('X', null, 'hero-b')]);
    expect(units[0]).toMatchObject({ freedByIndex: null, pendingAt: [null], doneAt: ['hero-b'] });
  });

  it('a swap-freed piece (displaced by another equip, not a cycle) carries the displacing unit\'s index', () => {
    // W: bag -> hero-b (displaces Y). Y: hero-b -> hero-c (now free, has its own target).
    const moveList: MoveAction[] = [unequip('Y', 'hero-b'), equip('Y', 'hero-b', 'hero-c'), equip('W', null, 'hero-b')];
    const units = deriveEquipUnits(moveList);
    expect(units).toHaveLength(2);
    const wUnit = units.find((u) => u.itemId === 'W')!;
    const yUnit = units.find((u) => u.itemId === 'Y')!;
    expect(wUnit).toMatchObject({ call: 'equip', displacesItemId: 'Y', freedByIndex: null });
    expect(yUnit).toMatchObject({
      call: 'equip',
      toHeroId: 'hero-c',
      freedByIndex: wUnit.index,
      pendingAt: ['hero-b', null],
      doneAt: ['hero-c'],
    });
  });

  it('an explicit-unequip-freed piece (a cycle) carries the unequip unit\'s index', () => {
    // hero-a wears X -> hero-b; hero-b wears Y -> hero-a (a 2-cycle).
    const moveList: MoveAction[] = [unequip('X', 'hero-a'), unequip('Y', 'hero-b'), equip('X', 'hero-a', 'hero-b'), equip('Y', 'hero-b', 'hero-a')];
    const units = deriveEquipUnits(moveList);
    expect(units).toHaveLength(3);
    const explicitUnequip = units.find((u) => u.call === 'unequip')!;
    expect(explicitUnequip).toMatchObject({ itemId: 'X', fromHeroId: 'hero-a', toHeroId: null, doneAt: [null, 'hero-b'] });
    const xEquip = units.find((u) => u.itemId === 'X' && u.call === 'equip')!;
    const yEquip = units.find((u) => u.itemId === 'Y' && u.call === 'equip')!;
    expect(xEquip.freedByIndex).toBe(explicitUnequip.index);
    expect(yEquip.freedByIndex).toBe(xEquip.index);
  });

  it('a bag-bound explicit unequip carries pendingAt [origin] and doneAt [null]', () => {
    const units = deriveEquipUnits([unequip('Z', 'hero-d')]);
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({
      call: 'unequip',
      itemId: 'Z',
      fromHeroId: 'hero-d',
      toHeroId: null,
      freedByIndex: null,
      pendingAt: ['hero-d'],
      doneAt: [null],
    });
  });
});

describe('deriveEquipUnits — edge cases', () => {
  it('an empty move list yields an empty unit list', () => {
    expect(deriveEquipUnits([])).toEqual([]);
  });

  it('a piece bound for the bag and displaced by an equip gets no unit of its own', () => {
    const moveList: MoveAction[] = [unequip('Y', 'hero-b'), equip('X', null, 'hero-b')];
    const units = deriveEquipUnits(moveList);
    expect(units.some((u) => u.itemId === 'Y')).toBe(false);
  });

  it('two pieces swapping heroes in the same slot emit one explicit unequip and two equips', () => {
    const moveList: MoveAction[] = [unequip('X', 'hero-a'), unequip('Y', 'hero-b'), equip('X', 'hero-a', 'hero-b'), equip('Y', 'hero-b', 'hero-a')];
    const units = deriveEquipUnits(moveList);
    expect(units.filter((u) => u.call === 'unequip')).toHaveLength(1);
    expect(units.filter((u) => u.call === 'equip')).toHaveLength(2);
    const explicitUnequip = units.find((u) => u.call === 'unequip')!;
    expect(explicitUnequip.doneAt).toEqual([null, 'hero-b']);
  });
});

describe('deriveEquipUnits — the swap-semantics property (seeded, >=500 cases)', () => {
  function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let mixed = state;
      mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  const SLOTS = Array.from({ length: 8 }, (_, i) => `slot${String(i)}`);

  type BoardItem = { itemId: string; slot: string; beforeHero: string | null; afterHero: string | null };

  function shuffle<T>(random: () => number, values: T[]): T[] {
    const out = [...values];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }

  function assignRandomly(random: () => number, heroes: string[], pool: string[], afterByHero: Map<string, string>): void {
    const shuffledHeroes = shuffle(random, heroes);
    const shuffledPool = shuffle(random, pool);
    const take = Math.min(shuffledHeroes.length, shuffledPool.length);
    for (let i = 0; i < take; i++) {
      if (random() < 0.15) continue;
      afterByHero.set(shuffledHeroes[i]!, shuffledPool[i]!);
    }
  }

  function generateScenario(random: () => number, heroCount: number): { items: BoardItem[]; heroes: string[] } {
    const heroes = Array.from({ length: heroCount }, (_, i) => `hero-${String(i)}`);
    const items: BoardItem[] = [];
    let itemSeq = 0;

    for (const slot of SLOTS) {
      const beforeByHero = new Map<string, string>();
      for (const hero of heroes) {
        if (random() < 0.85) beforeByHero.set(hero, `item-${String(itemSeq++)}`);
      }
      const bagCount = Math.floor(random() * 3);
      const bagItems = Array.from({ length: bagCount }, () => `item-${String(itemSeq++)}`);
      const pool = [...beforeByHero.values(), ...bagItems];

      const afterByHero = new Map<string, string>();
      const withBefore = [...beforeByHero.keys()];
      const useCycle = withBefore.length >= 2 && random() < 0.3;
      if (useCycle) {
        const cycleLen = withBefore.length >= 3 && random() < 0.5 ? 3 : 2;
        const cycleHeroes = shuffle(random, withBefore).slice(0, cycleLen);
        for (let i = 0; i < cycleHeroes.length; i++) {
          const fromHero = cycleHeroes[i]!;
          const toHero = cycleHeroes[(i + 1) % cycleHeroes.length]!;
          afterByHero.set(toHero, beforeByHero.get(fromHero)!);
        }
        const usedInCycle = new Set(cycleHeroes.map((h) => beforeByHero.get(h)!));
        const remainingPool = pool.filter((id) => !usedInCycle.has(id));
        const remainingHeroes = heroes.filter((h) => !cycleHeroes.includes(h));
        assignRandomly(random, remainingHeroes, remainingPool, afterByHero);
      } else {
        assignRandomly(random, heroes, pool, afterByHero);
      }

      const beforeByItem = new Map<string, string>();
      for (const [hero, itemId] of beforeByHero) beforeByItem.set(itemId, hero);
      const afterByItem = new Map<string, string>();
      for (const [hero, itemId] of afterByHero) afterByItem.set(itemId, hero);

      for (const itemId of pool) {
        items.push({ itemId, slot, beforeHero: beforeByItem.get(itemId) ?? null, afterHero: afterByItem.get(itemId) ?? null });
      }
    }

    return { items, heroes };
  }

  function buildMoveListFromBoard(items: BoardItem[]): MoveAction[] {
    const unequips: MoveAction[] = [];
    const equips: MoveAction[] = [];
    for (const item of items) {
      if (item.beforeHero === item.afterHero) continue;
      const defId = `def-${item.itemId}`;
      if (item.beforeHero !== null) {
        unequips.push({ phase: 'unequip', itemId: item.itemId, defId, slot: item.slot, fromHeroId: item.beforeHero, toHeroId: null });
      }
      if (item.afterHero !== null) {
        equips.push({ phase: 'equip', itemId: item.itemId, defId, slot: item.slot, fromHeroId: item.beforeHero, toHeroId: item.afterHero });
      }
    }
    return [...unequips, ...equips];
  }

  function simulateAndVerify(units: readonly ApplyEquipUnit[], items: readonly BoardItem[]): Map<string, string | null> {
    const wearer = new Map<string, string | null>(items.map((item) => [item.itemId, item.beforeHero]));
    const occupant = new Map<string, string>();
    for (const item of items) {
      if (item.beforeHero !== null) occupant.set(`${item.beforeHero}/${item.slot}`, item.itemId);
    }
    for (const unit of units) {
      if (unit.call === 'unequip') {
        const hero = wearer.get(unit.itemId);
        if (hero !== null && hero !== undefined) occupant.delete(`${hero}/${unit.slot}`);
        wearer.set(unit.itemId, null);
      } else {
        expect(wearer.get(unit.itemId), `equip unit ${String(unit.index)} for ${unit.itemId} must be bag-resident at its turn`).toBeNull();
        const key = `${String(unit.toHeroId)}/${unit.slot}`;
        const occupied = occupant.get(key);
        if (occupied !== undefined) wearer.set(occupied, null);
        wearer.set(unit.itemId, unit.toHeroId);
        occupant.set(key, unit.itemId);
      }
    }
    return wearer;
  }

  const CASES = 520;

  for (let seed = 1; seed <= CASES; seed++) {
    it(`case #${String(seed)}: end state matches the plan and unit counts are exact`, () => {
      const random = mulberry32(seed * 2654435761);
      const heroCount = 1 + Math.floor(random() * 6);
      const { items } = generateScenario(random, heroCount);
      const moveList = buildMoveListFromBoard(items);
      const units = deriveEquipUnits(moveList);

      const finalWearer = simulateAndVerify(units, items);
      for (const item of items) {
        expect(finalWearer.get(item.itemId), `item ${item.itemId} must end where the plan puts it`).toBe(item.afterHero);
      }

      const equipUnitCount = units.filter((u) => u.call === 'equip').length;
      const movedElsewhereCount = items.filter((item) => item.afterHero !== null && item.afterHero !== item.beforeHero).length;
      expect(equipUnitCount).toBe(movedElsewhereCount);

      units.forEach((unit, index) => expect(unit.index).toBe(index));
    });
  }
});

describe('preflightEquipUnits — verdict precedence', () => {
  function liveFrom(wearer: Record<string, string | null>, heroIds: string[]): LiveGearState {
    return { wearerByItemId: new Map(Object.entries(wearer)), heroIds: new Set(heroIds) };
  }

  const doneUnit: ApplyEquipUnit = {
    index: 0,
    call: 'equip',
    itemId: 'X',
    defId: 'defX',
    slot: SLOT,
    fromHeroId: null,
    toHeroId: 'hero-b',
    displacesItemId: null,
    freedByIndex: null,
    pendingAt: [null],
    doneAt: ['hero-b'],
  };

  it('heroMissing takes precedence over everything for an equip unit, even when the piece is in the bag', () => {
    const live = liveFrom({ X: null }, []);
    const [verdict] = preflightEquipUnits([doneUnit], live);
    expect(verdict).toEqual({ index: 0, status: 'conflict', reason: 'heroMissing' });
  });

  it('itemMissing when the piece is absent from the live account', () => {
    const live = liveFrom({}, ['hero-b']);
    const [verdict] = preflightEquipUnits([doneUnit], live);
    expect(verdict).toEqual({ index: 0, status: 'conflict', reason: 'itemMissing' });
  });

  it('done when the piece is at a doneAt location', () => {
    const live = liveFrom({ X: 'hero-b' }, ['hero-b']);
    const [verdict] = preflightEquipUnits([doneUnit], live);
    expect(verdict).toEqual({ index: 0, status: 'done' });
  });

  it('pending when the piece is at a pendingAt location', () => {
    const live = liveFrom({ X: null }, ['hero-b']);
    const [verdict] = preflightEquipUnits([doneUnit], live);
    expect(verdict).toEqual({ index: 0, status: 'pending' });
  });

  it('itemMoved when the piece is worn elsewhere entirely (fallback)', () => {
    const live = liveFrom({ X: 'hero-c' }, ['hero-b', 'hero-c']);
    const [verdict] = preflightEquipUnits([doneUnit], live);
    expect(verdict).toEqual({ index: 0, status: 'conflict', reason: 'itemMoved' });
  });

  it('an unequip unit ignores hero presence entirely', () => {
    const unequipUnit: ApplyEquipUnit = {
      index: 0,
      call: 'unequip',
      itemId: 'Z',
      defId: 'defZ',
      slot: SLOT,
      fromHeroId: 'hero-d',
      toHeroId: null,
      displacesItemId: null,
      freedByIndex: null,
      pendingAt: ['hero-d'],
      doneAt: [null],
    };
    const live = liveFrom({ Z: 'hero-d' }, []);
    const [verdict] = preflightEquipUnits([unequipUnit], live);
    expect(verdict).toEqual({ index: 0, status: 'pending' });
  });

  it('the freedByIndex rule: a skipped-in-settled freeing unit reads itemMoved, not pending', () => {
    const equipUnit: ApplyEquipUnit = { ...doneUnit, freedByIndex: 0, doneAt: ['hero-b'], pendingAt: [null] };
    const live = liveFrom({ X: 'hero-c' }, ['hero-b', 'hero-c']);
    const settled = new Map<number, 'ok' | 'skipped'>([[0, 'skipped']]);
    const [verdict] = preflightEquipUnits([equipUnit], live, settled);
    expect(verdict).toEqual({ index: 0, status: 'conflict', reason: 'itemMoved' });
  });

  it('the freedByIndex rule: an ok-in-settled freeing unit does not block — the location decides normally', () => {
    const equipUnit: ApplyEquipUnit = { ...doneUnit, freedByIndex: 0, doneAt: ['hero-b'], pendingAt: [null] };
    const live = liveFrom({ X: null }, ['hero-b']);
    const settled = new Map<number, 'ok' | 'skipped'>([[0, 'ok']]);
    const [verdict] = preflightEquipUnits([equipUnit], live, settled);
    expect(verdict).toEqual({ index: 0, status: 'pending' });
  });

  it('the freedByIndex rule without settled: a conflicting freeing unit in the same pass reads itemMoved', () => {
    const freeingUnit: ApplyEquipUnit = {
      index: 0,
      call: 'unequip',
      itemId: 'Y',
      defId: 'defY',
      slot: SLOT,
      fromHeroId: 'hero-c',
      toHeroId: null,
      displacesItemId: null,
      freedByIndex: null,
      pendingAt: ['hero-c'],
      doneAt: [null],
    };
    const equipUnit: ApplyEquipUnit = { ...doneUnit, index: 1, freedByIndex: 0, doneAt: ['hero-b'], pendingAt: [null] };
    // Y is still worn at hero-c (not at its own pendingAt/doneAt), so its own verdict is a conflict —
    // which then blocks X's equip from reading pending.
    const live = liveFrom({ Y: 'hero-e', X: 'hero-c' }, ['hero-b', 'hero-c', 'hero-e']);
    const verdicts = preflightEquipUnits([freeingUnit, equipUnit], live);
    expect(verdicts[0]).toEqual({ index: 0, status: 'conflict', reason: 'itemMoved' });
    expect(verdicts[1]).toEqual({ index: 1, status: 'conflict', reason: 'itemMoved' });
  });

  it('the freedByIndex rule without settled: an ok freeing unit in the same pass follows the location normally', () => {
    const freeingUnit: ApplyEquipUnit = {
      index: 0,
      call: 'unequip',
      itemId: 'Y',
      defId: 'defY',
      slot: SLOT,
      fromHeroId: 'hero-c',
      toHeroId: null,
      displacesItemId: null,
      freedByIndex: null,
      pendingAt: ['hero-c'],
      doneAt: [null],
    };
    const equipUnit: ApplyEquipUnit = { ...doneUnit, index: 1, freedByIndex: 0, doneAt: ['hero-b'], pendingAt: [null] };
    const live = liveFrom({ Y: null, X: null }, ['hero-b', 'hero-c']);
    const verdicts = preflightEquipUnits([freeingUnit, equipUnit], live);
    expect(verdicts[0]).toEqual({ index: 0, status: 'done' });
    expect(verdicts[1]).toEqual({ index: 1, status: 'pending' });
  });
});

describe('preflightEquipUnits — after the whole step ran, and a hand-moved piece', () => {
  it('every unit reads done once the account matches the plan', () => {
    const moveList: MoveAction[] = [unequip('Y', 'hero-b'), equip('Y', 'hero-b', 'hero-c'), equip('W', null, 'hero-b')];
    const units = deriveEquipUnits(moveList);
    const live: LiveGearState = {
      wearerByItemId: new Map([
        ['W', 'hero-b'],
        ['Y', 'hero-c'],
      ]),
      heroIds: new Set(['hero-b', 'hero-c']),
    };
    const verdicts = preflightEquipUnits(units, live);
    expect(verdicts.every((v) => v.status === 'done')).toBe(true);
  });

  it('a piece moved by hand to a third hero reads itemMoved', () => {
    const units = deriveEquipUnits([equip('X', null, 'hero-b')]);
    const live: LiveGearState = { wearerByItemId: new Map([['X', 'hero-z']]), heroIds: new Set(['hero-b', 'hero-z']) };
    const [verdict] = preflightEquipUnits(units, live);
    expect(verdict).toEqual({ index: 0, status: 'conflict', reason: 'itemMoved' });
  });
});

describe('liveGearStateFromRows', () => {
  it('returns null when either section is missing', () => {
    expect(liveGearStateFromRows(null, [])).toBeNull();
    expect(liveGearStateFromRows([], undefined)).toBeNull();
  });

  it('ignores rows without a string id', () => {
    const state = liveGearStateFromRows([{ id: 'i1', equipped_on: 'h1' }, { notId: 'nope' }, null], [{ id: 'h1' }]);
    expect(state?.wearerByItemId.has('i1')).toBe(true);
    expect(state?.wearerByItemId.size).toBe(1);
  });

  it('reads an empty equipped_on as the bag', () => {
    const state = liveGearStateFromRows([{ id: 'i1', equipped_on: '' }, { id: 'i2' }], [{ id: 'h1' }]);
    expect(state?.wearerByItemId.get('i1')).toBeNull();
    expect(state?.wearerByItemId.get('i2')).toBeNull();
  });
});

describe('summarizeApplyVerdicts', () => {
  it('counts pending, done, conflict and by reason', () => {
    const verdicts: ApplyUnitVerdict[] = [
      { index: 0, status: 'pending' },
      { index: 1, status: 'done' },
      { index: 2, status: 'conflict', reason: 'itemMissing' },
      { index: 3, status: 'conflict', reason: 'itemMissing' },
      { index: 4, status: 'conflict', reason: 'heroMissing' },
    ];
    expect(summarizeApplyVerdicts(verdicts)).toEqual({
      pending: 1,
      done: 1,
      conflict: 3,
      byReason: { itemMissing: 2, heroMissing: 1, itemMoved: 0, allocationChanged: 0 },
    });
  });
});
