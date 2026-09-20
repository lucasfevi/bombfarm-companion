import { describe, expect, it } from 'vitest';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { NO_AURAS_AT_CAP } from '@bombfarm/domain/team-buffs';
import type { TeamPlanInputs } from './team-plan-inputs';
import type { TeamPlanControls } from './team-plan-controls';
import { describePlanChanges, planBasisSignature, type PlanBasis, type PlanChange } from './plan-changes';

const ZERO = { attack: 0, energy: 0, speed: 0, critChance: 0, critDmg: 0, penetration: 0, cdr: 0, luck: 0 };

function hero(overrides: Partial<HeroRecord> & { id: string }): HeroRecord {
  return {
    name: overrides.id.toUpperCase(),
    updatedAt: 1,
    rarity: 'Raro',
    level: 50,
    stars: 0,
    naked: { ...ZERO, attack: 100 },
    loadout: {},
    altLoadout: null,
    gearedOverride: ZERO,
    abilities: { bomba_dupla: 3 },
    pts: { ...ZERO, attack: 40, speed: 9 },
    statPointsAvailable: 0,
    deployed: false,
    battleAllowed: true,
    power: 1000,
    ...overrides,
  };
}

function item(overrides: Partial<InventoryItem> & { id: string }): InventoryItem {
  return {
    defId: 'autumn_boots',
    rarityIdx: 1,
    level: 50,
    upgrade: 12,
    slot: 'bota',
    equipped: false,
    equippedBy: null,
    defResolved: true,
    marketBlocked: false,
    ...overrides,
  };
}

function inputs(overrides: Partial<TeamPlanInputs> = {}): TeamPlanInputs {
  return {
    heroes: [hero({ id: 'rowan' }), hero({ id: 'minato' })],
    inventory: { version: 1, importedAt: 0, items: [item({ id: 'boots', equipped: true, equippedBy: 'minato' }), item({ id: 'ring', defId: 'autumn_ring', slot: 'anel' })] },
    treeDanoTotal: 41,
    treeEnergy: 0,
    treeSpeed: 0,
    treeCritChance: 0,
    treeCritDmg: 0,
    treeLuckFlatPct: 0,
    treeTeamCoinPct: 0,
    treeXpMult: 1,
    houseIdx: 3,
    houseLevel: 2,
    phase: 91,
    mitigationPct: 0,
    slots: 5,
    fieldSlots: 9,
    houseCycleSecs: 300,
    houseCycleSecsHouseIdx: 3,
    houseCycleSecsLevel: 2,
    maxPhase: 91,
    farmChosenPhase: null,
    ...overrides,
  };
}

function controls(overrides: Partial<TeamPlanControls> = {}): TeamPlanControls {
  return {
    scopeByHeroId: {},
    forgeFloor: 12,
    objective: 'farm',
    allowedChanges: 'both',
    ignoreFieldCrowding: false,
    aurasAtCap: NO_AURAS_AT_CAP,
    targetPhase: null,
    targetPhaseChosen: false,
    ...overrides,
  };
}

const basis: PlanBasis = { inputs: inputs(), controls: controls() };

function withHero(patch: Partial<HeroRecord>, id = 'rowan'): PlanBasis {
  return { ...basis, inputs: inputs({ heroes: basis.inputs.heroes.map((h) => (h.id === id ? { ...h, ...patch } : h)) }) };
}
function withItem(patch: Partial<InventoryItem>, id = 'boots'): PlanBasis {
  const items = basis.inputs.inventory.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
  return { ...basis, inputs: inputs({ inventory: { version: 1, importedAt: 0, items } }) };
}

const fields = (ledger: readonly PlanChange[]) => ledger.map((c) => c.detail.field);

describe('describePlanChanges — nothing changed', () => {
  it('an identical basis lists nothing and counts zero', () => {
    const ledger = describePlanChanges(basis, basis, null);
    expect(ledger.counted).toBe(0);
    expect(ledger.plan).toEqual([]);
    expect(ledger.noise).toEqual([]);
  });
});

describe('the changes the plan does not depend on are listed as noise, never counted', () => {
  it('a hero walking off the field or back on', () => {
    const ledger = describePlanChanges(basis, withHero({ deployed: true }), null);
    expect(ledger.counted).toBe(0);
    expect(ledger.noise).toEqual([{ subject: { kind: 'hero', id: 'rowan', name: 'ROWAN' }, detail: { field: 'fieldRotation', onField: true }, verdict: 'noise' }]);
  });

  it("battle permission, when the player has scoped the hero explicitly so the default never applies", () => {
    const scoped = { inputs: basis.inputs, controls: controls({ scopeByHeroId: { rowan: 'optimize', minato: 'optimize' } }) };
    const ledger = describePlanChanges(scoped, { ...withHero({ battleAllowed: false }), controls: scoped.controls }, null);
    expect(ledger.counted).toBe(0);
    expect(fields(ledger.noise)).toEqual(['battleAllowed']);
  });

  it("battle permission that flips the hero's DEFAULT scope is a scope change, counted", () => {
    const ledger = describePlanChanges(basis, withHero({ battleAllowed: false }), null);
    expect(ledger.counted).toBe(1);
    expect(ledger.other[0]?.detail).toEqual({ field: 'scope', heroId: 'rowan', heroName: 'ROWAN', before: 'optimize', after: 'donate' });
    expect(fields(ledger.noise)).toEqual(['battleAllowed']);
  });

  it('a re-derived power figure, alone', () => {
    const ledger = describePlanChanges(basis, withHero({ power: 1234 }), null);
    expect(ledger.counted).toBe(0);
    expect(fields(ledger.noise)).toEqual(['power']);
  });

  it("a rune's seconds ticking down is not a change at all", () => {
    const rune = { axis: 'crit', strengthPct: 10, playSecondsLeft: 2000, rarity: 1 } as const;
    const before = withHero({ runes: [rune] });
    const after = withHero({ runes: [{ ...rune, playSecondsLeft: 1500 }] });
    expect(describePlanChanges(before, after, null).counted).toBe(0);
    expect(describePlanChanges(before, after, null).noise).toEqual([]);
  });

  it('a storage timestamp on the hero, or an import stamp on the bag', () => {
    expect(describePlanChanges(basis, withHero({ updatedAt: 99 }), null).counted).toBe(0);
    const restamped = { ...basis, inputs: inputs({ inventory: { ...basis.inputs.inventory, importedAt: 99 } }) };
    expect(describePlanChanges(basis, restamped, null).counted).toBe(0);
  });
});

describe('the changes the plan depends on, each named with before and after', () => {
  it('a hero levelled', () => {
    const ledger = describePlanChanges(basis, withHero({ level: 51 }), null);
    expect(ledger.plan).toEqual([{ subject: { kind: 'hero', id: 'rowan', name: 'ROWAN' }, detail: { field: 'level', before: 50, after: 51 }, verdict: 'plan' }]);
  });

  it('points spent elsewhere than the plan asked count, but fold into the "also changed" line rather than a row', () => {
    const ledger = describePlanChanges(basis, withHero({ pts: { ...ZERO, attack: 41, speed: 9 }, statPointsAvailable: 0 }), null);
    expect(fields(ledger.other)).toEqual(['points']);
    expect(ledger.other[0]?.detail).toEqual({ field: 'points', stat: 'attack', before: 40, after: 41, asked: null });
    expect(ledger.listed).toBe(0);
    expect(ledger.counted).toBe(1);
  });

  it('a rune that appeared, and one that expired', () => {
    const rune = { axis: 'crit', strengthPct: 10, playSecondsLeft: 2000, rarity: 1 } as const;
    expect(fields(describePlanChanges(basis, withHero({ runes: [rune] }), null).plan)).toEqual(['runeGained']);
    expect(fields(describePlanChanges(withHero({ runes: [rune] }), basis, null).plan)).toEqual(['runeLost']);
  });

  it('a hero new on the roster is a row, with the level it arrived at', () => {
    const grown = { ...basis, inputs: inputs({ heroes: [...basis.inputs.heroes, hero({ id: 'kira' })] }) };
    expect(describePlanChanges(basis, grown, null).plan[0]?.detail).toEqual({ field: 'heroAdded', level: 50 });
  });

  it('a hero gone from the roster BREAKS the plan when the plan placed it, and is a plain row when it did not', () => {
    const grown = { ...basis, inputs: inputs({ heroes: [...basis.inputs.heroes, hero({ id: 'kira' })] }) };
    // Every hero defaults to Optimize scope, so kira was placed.
    const placed = describePlanChanges(grown, basis, null);
    expect(placed.breaks[0]?.detail).toEqual({ field: 'heroRemoved', used: true });
    expect(placed.plan).toEqual([]);
    // Scoped out by the player before the plan was built: gone, but the plan never counted on it.
    const benched = { ...grown, controls: controls({ scopeByHeroId: { kira: 'leaveAlone' } }) };
    const notPlaced = describePlanChanges(benched, { ...basis, controls: benched.controls }, null);
    expect(notPlaced.plan[0]?.detail).toEqual({ field: 'heroRemoved', used: false });
    expect(notPlaced.breaks).toEqual([]);
  });

  it('a forge the plan did not ask for, or a piece moved by hand, count but fold into the "also changed" line', () => {
    expect(fields(describePlanChanges(basis, withItem({ upgrade: 13 }), null).other)).toEqual(['forge']);
    expect(fields(describePlanChanges(basis, withItem({ equippedBy: 'rowan' }), null).other)).toEqual(['equippedBy']);
  });

  it('a piece new in the bag is a row, with the level it came at', () => {
    const gained = { ...basis, inputs: inputs({ inventory: { version: 1, importedAt: 0, items: [...basis.inputs.inventory.items, item({ id: 'helm', defId: 'autumn_helm', slot: 'elmo' })] } }) };
    expect(describePlanChanges(basis, gained, null).plan[0]?.detail).toEqual({ field: 'itemAdded', level: 50 });
  });

  it('a piece gone from the bag BREAKS the plan only when the plan used it; an unused one is folded away', () => {
    // The boots are worn by minato, who is in scope: the plan's loadout keeps them.
    const withoutBoots = { ...basis, inputs: inputs({ inventory: { version: 1, importedAt: 0, items: basis.inputs.inventory.items.filter((i) => i.id !== 'boots') } }) };
    const worn = describePlanChanges(basis, withoutBoots, null);
    expect(worn.breaks[0]?.detail).toEqual({ field: 'itemRemoved', used: true });
    // The ring sits in the bag unworn and no plan touches it: sold, donated, fused — not a row.
    const withoutRing = { ...basis, inputs: inputs({ inventory: { version: 1, importedAt: 0, items: basis.inputs.inventory.items.filter((i) => i.id !== 'ring') } }) };
    const loose = describePlanChanges(basis, withoutRing, null);
    expect(loose.breaks).toEqual([]);
    expect(loose.plan).toEqual([]);
    expect(loose.other[0]?.detail).toEqual({ field: 'itemRemoved', used: false });
  });

  it('a piece the plan moves onto a hero counts as used even while it still sits in the bag', () => {
    const plan = { steps: [], forgeList: [], moveList: [{ phase: 'equip', itemId: 'ring', defId: 'autumn_ring', slot: 'anel', fromHeroId: null, toHeroId: 'rowan' }], pointResets: [] } as unknown as TeamPlan;
    const withoutRing = { ...basis, inputs: inputs({ inventory: { version: 1, importedAt: 0, items: basis.inputs.inventory.items.filter((i) => i.id !== 'ring') } }) };
    expect(describePlanChanges(basis, withoutRing, plan).breaks[0]?.detail).toEqual({ field: 'itemRemoved', used: true });
  });

  it('an unequipped piece reads as equipped by nobody, whatever stale name it still carries', () => {
    const ledger = describePlanChanges(basis, withItem({ equipped: false, equippedBy: 'minato' }), null);
    expect(ledger.other[0]?.detail).toEqual({ field: 'equippedBy', before: 'minato', after: null, asked: null });
  });

  it('the skill tree is a row; the house, the farming phase and the slots fold into the "also changed" line', () => {
    expect(describePlanChanges(basis, { ...basis, inputs: inputs({ treeDanoTotal: 42 }) }, null).plan[0]?.detail).toEqual({ field: 'tree', axis: 'treeDanoTotal', before: 41, after: 42 });
    expect(describePlanChanges(basis, { ...basis, inputs: inputs({ houseLevel: 3 }) }, null).other[0]?.detail).toEqual({ field: 'accountField', name: 'houseLevel', before: 2, after: 3 });
    // A phase change reaches the plan twice when no phase is pinned: as the account's phase and
    // as the phase the plan scores at.
    expect(fields(describePlanChanges(basis, { ...basis, inputs: inputs({ phase: 92 }) }, null).other)).toEqual(['accountField', 'control']);
  });

  it('the controls count and fold: forge floor, objective, a scope the player changed', () => {
    const floor = describePlanChanges(basis, { ...basis, controls: controls({ forgeFloor: 13 }) }, null);
    expect(floor.other[0]?.detail).toEqual({ field: 'control', name: 'forgeFloor', before: '12', after: '13' });
    const scope = describePlanChanges(basis, { ...basis, controls: controls({ scopeByHeroId: { minato: 'leaveAlone' } }) }, null);
    expect(scope.other[0]?.detail).toEqual({ field: 'scope', heroId: 'minato', heroName: 'MINATO', before: 'optimize', after: 'leaveAlone' });
  });
});

describe('a change the plan itself asked for is progress, not a reason to recompute', () => {
  const plan = {
    steps: [],
    forgeList: [{ itemId: 'boots', defId: 'autumn_boots', from: 12, to: 14 }],
    moveList: [{ phase: 'equip', itemId: 'ring', defId: 'autumn_ring', slot: 'anel', fromHeroId: null, toHeroId: 'rowan' }],
    pointResets: [{ heroId: 'rowan', ptsBefore: { ...ZERO, attack: 40, speed: 9 }, pts: { ...ZERO, attack: 45, speed: 4 }, perHero: 0 }],
  } as unknown as TeamPlan;

  it('a forge step towards the target, and the target itself', () => {
    expect(describePlanChanges(basis, withItem({ upgrade: 13 }), plan).progress[0]?.detail).toEqual({ field: 'forge', before: 12, after: 13, asked: 14 });
    expect(describePlanChanges(basis, withItem({ upgrade: 14 }), plan).progress).toHaveLength(1);
  });

  it('a forge past the target is a change, not progress', () => {
    const ledger = describePlanChanges(basis, withItem({ upgrade: 15 }), plan);
    expect(ledger.progress).toEqual([]);
    expect(ledger.other[0]?.detail).toEqual({ field: 'forge', before: 12, after: 15, asked: 14 });
  });

  it('a point spent where the plan said, and one spent elsewhere', () => {
    const towards = describePlanChanges(basis, withHero({ pts: { ...ZERO, attack: 42, speed: 9 } }), plan);
    expect(towards.progress[0]?.detail).toEqual({ field: 'points', stat: 'attack', before: 40, after: 42, asked: 45 });
    const elsewhere = describePlanChanges(basis, withHero({ pts: { ...ZERO, attack: 40, speed: 10 } }), plan);
    expect(elsewhere.progress).toEqual([]);
    expect(elsewhere.other[0]?.detail).toEqual({ field: 'points', stat: 'speed', before: 9, after: 10, asked: 4 });
  });

  it('a piece equipped where the plan moved it', () => {
    const ledger = describePlanChanges(basis, withItem({ equipped: true, equippedBy: 'rowan' }, 'ring'), plan);
    expect(ledger.progress[0]?.detail).toEqual({ field: 'equippedBy', before: null, after: 'rowan', asked: 'rowan' });
  });
});

describe('the signature and the ledger agree by construction', () => {
  const cases: [string, PlanBasis][] = [
    ['deployed', withHero({ deployed: true })],
    ['power', withHero({ power: 5 })],
    ['updatedAt', withHero({ updatedAt: 7 })],
    ['level', withHero({ level: 51 })],
    ['stars', withHero({ stars: 1 })],
    ['ability', withHero({ abilities: { bomba_dupla: 4 } })],
    ['birth', withHero({ birth: { ...ZERO, attack: 3 } })],
    ['forge', withItem({ upgrade: 13 })],
    ['item level', withItem({ level: 51 })],
    ['tree', { ...basis, inputs: inputs({ treeEnergy: 1 }) }],
    ['field slots', { ...basis, inputs: inputs({ fieldSlots: 8 }) }],
    ['max phase', { ...basis, inputs: inputs({ maxPhase: 95 }) }],
    ['aura at cap', { ...basis, controls: controls({ aurasAtCap: ['folego'] as never }) }],
    ['crowding', { ...basis, controls: controls({ ignoreFieldCrowding: true }) }],
    ['farm phase chosen elsewhere', { ...basis, inputs: inputs({ farmChosenPhase: 80 }) }],
  ];

  it.each(cases)('%s: the signature moves iff the ledger counts a change', (_label, now) => {
    const moved = planBasisSignature(basis.inputs, basis.controls) !== planBasisSignature(now.inputs, now.controls);
    expect(describePlanChanges(basis, now, null).counted > 0).toBe(moved);
  });
});
