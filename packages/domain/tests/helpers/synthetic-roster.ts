/**
 * Seeded synthetic rosters for the team-plan solver's property suites.
 *
 * Deterministic by construction: every random draw comes from {@link mulberry32}, never
 * `Math.random`, so a red run is reproduced by re-running the seed printed in its failure
 * message. Nothing here is read from a capture — the properties these rosters drive are claims
 * about ANY account, so pinning one account's numbers would weaken them into fixture assertions.
 */
import { defsForSlot, setsForLevel, SLOTS } from '@bombfarm/domain/gear';
import type { EquippedItem, Loadout, SheetStats } from '@bombfarm/domain/gear/types';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import type { RarityKey } from '@bombfarm/domain/model';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { ScopeState, TeamPlanHeroInput, TeamPlanInput } from '@bombfarm/domain/team-plan/types';
import { mulberry32 } from './seeded-random';

/** Catalog item levels the generator draws from; each has a full eight-slot set. */
const ITEM_LEVEL_TIERS = [10, 20, 30, 40, 50, 60] as const;
const TOP_ITEM_LEVEL = ITEM_LEVEL_TIERS[ITEM_LEVEL_TIERS.length - 1];

/**
 * Two hero levels are pinned rather than drawn, and both sit below {@link TOP_ITEM_LEVEL}: the
 * weakest below most item tiers, the strongest below the top one. Every bag therefore holds gear
 * some heroes may not wear and gear nobody may, which is what makes the LEVEL half of the pool's
 * eligibility rule falsifiable — a roster whose every item fits every hero cannot tell a working
 * level check from a missing one.
 */
const WEAKEST_HERO_LEVEL = 25;
const STRONGEST_HERO_LEVEL = 55;

const RARITY_BY_STAT_COUNT: readonly RarityKey[] = [
  'Comum',
  'Incomum',
  'Raro',
  'Épico',
  'Lendária',
  'Mítico',
];

export type SyntheticRosterOptions = {
  heroCount?: number;
  spareItemCount?: number;
  forgeFloor?: number;
  /** The scope given to the last hero. Omitted, every hero is in the search's scope. */
  outOfScope?: Extract<ScopeState, 'donate' | 'leaveAlone'>;
  /** Pinned rather than drawn, for a roster that must land in a chosen saturation regime. */
  fieldSlots?: number;
};

function pick<T>(rng: () => number, values: readonly T[]): T {
  return values[Math.floor(rng() * values.length)]!;
}

function between(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function defForSlotAtLevel(slot: string, level: number): string {
  const set = setsForLevel(level)[0]!;
  return defsForSlot(slot, set)[0]!.id;
}

function syntheticBirth(rng: () => number): SheetStats {
  return {
    attack: between(rng, 40, 200),
    energy: between(rng, 80, 200),
    speed: between(rng, 45, 55),
    critChance: between(rng, 4, 10),
    critDmg: between(rng, 45, 80),
    penetration: between(rng, 0.5, 3),
    cdr: between(rng, 1, 4),
    luck: between(rng, 2, 7),
  };
}

function heroLevel(rng: () => number, index: number): number {
  if (index === 0) return WEAKEST_HERO_LEVEL;
  if (index === 1) return STRONGEST_HERO_LEVEL;
  return Math.floor(between(rng, WEAKEST_HERO_LEVEL, STRONGEST_HERO_LEVEL + 1));
}

function itemAt(
  rng: () => number,
  id: string,
  slot: string,
  level: number,
  ownerId: string | null,
  forgeFloor: number,
): InventoryItem {
  return {
    id,
    defId: defForSlotAtLevel(slot, level),
    rarityIdx: Math.floor(rng() * 6),
    level,
    upgrade: Math.floor(rng() * (forgeFloor + 4)),
    slot,
    equipped: ownerId !== null,
    equippedBy: ownerId,
    defResolved: true,
    marketBlocked: false,
  };
}

function equippedFrom(item: InventoryItem): EquippedItem {
  return {
    defId: item.defId,
    rarityIdx: item.rarityIdx,
    level: item.level,
    upgrade: item.upgrade,
  };
}

/**
 * One synthetic account: a roster, the inventory it wears and banks, and the account terms the
 * DPS objective reads. A hero's own gear is always gear that hero can wear, so the baseline
 * assignment is a legal one; the BAG deliberately is not — see {@link WEAKEST_HERO_LEVEL}.
 */
export function syntheticTeamPlanInput(
  seed: number,
  options: SyntheticRosterOptions = {},
): TeamPlanInput {
  const rng = mulberry32(seed);
  const heroCount = options.heroCount ?? 3;
  const spareItemCount = options.spareItemCount ?? 8;
  const forgeFloor = options.forgeFloor ?? 10;

  const heroes: TeamPlanHeroInput[] = [];
  const inventory: InventoryItem[] = [];
  const scopeByHeroId: Record<string, ScopeState> = {};

  for (let index = 0; index < heroCount; index++) {
    const heroId = `hero-${index}`;
    const level = heroLevel(rng, index);
    const wearable = ITEM_LEVEL_TIERS.filter((tier) => tier <= level);
    const loadout: Loadout = {};
    for (const slot of SLOTS) {
      if (rng() < 0.4) {
        loadout[slot] = null;
        continue;
      }
      const item = itemAt(rng, `item-${index}-${slot}`, slot, pick(rng, wearable), heroId, forgeFloor);
      inventory.push(item);
      loadout[slot] = equippedFrom(item);
    }
    heroes.push({
      heroId,
      name: `Synthetic ${index}`,
      level,
      stars: Math.floor(rng() * 3),
      rarity: pick(rng, RARITY_BY_STAT_COUNT),
      birth: syntheticBirth(rng),
      abilities: {},
      pts: ZERO_PTS(),
      loadout,
      battleAllowed: true,
    });
    scopeByHeroId[heroId] = 'optimize';
  }

  const weakest = Math.min(...heroes.map((hero) => hero.level));
  const aboveTheWeakest = ITEM_LEVEL_TIERS.find((tier) => tier > weakest && tier <= STRONGEST_HERO_LEVEL)!;

  for (let index = 0; index < spareItemCount; index++) {
    const slot = pick(rng, SLOTS);
    const level = pick(rng, ITEM_LEVEL_TIERS);
    const item = itemAt(rng, `spare-${index}`, slot, level, null, forgeFloor);
    // Four exclusions the pool owes the search, forced rather than left to the draw so a shape
    // cannot quietly stop covering one: gear nobody may wear, gear only the stronger heroes may,
    // a market-blocked spare and an unresolvable one. A roster asked for fewer than four spares
    // keeps them all plain — its callers want an exactly known bag.
    if (spareItemCount >= 4) {
      if (index === 0) item.level = TOP_ITEM_LEVEL;
      if (index === 1) item.level = aboveTheWeakest;
      if (index === 0 || index === 1) item.defId = defForSlotAtLevel(slot, item.level);
      if (index === spareItemCount - 1) item.marketBlocked = true;
      if (index === spareItemCount - 2) item.defResolved = false;
    }
    inventory.push(item);
  }

  if (options.outOfScope && heroCount >= 3) {
    scopeByHeroId[heroes[heroCount - 1]!.heroId] = options.outOfScope;
  }

  return {
    heroes,
    inventory,
    account: {
      treeSheet: {
        /** The neutral skill-tree multiplier on the attack subtotal; 0 would zero every sheet. */
        danoStatic: 1,
        energyPct: 0,
        speedPct: 0,
        critChancePct: 0,
        critDmgPct: 0,
        luckFlatPct: 0,
      },
      houseIdx: 0,
      houseLevel: 1,
      phase: 1,
      mitigationPct: 0,
      slots: heroCount,
      fieldSlots: options.fieldSlots ?? 1 + Math.floor(rng() * heroCount),
    },
    scopeByHeroId,
    forgeFloor,
  };
}
