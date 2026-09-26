import { SLOTS, type EquippedItem } from '@bombfarm/domain/gear';
import type { RarityKey } from '@bombfarm/domain/model';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

/** The squad is every hero the account lets into battle; a hero never asked about counts as in. */
export function isSquadHero(hero: Pick<HeroRecord, 'battleAllowed'>): boolean {
  return hero.battleAllowed !== false;
}

export function equippedItemsOf(hero: Pick<HeroRecord, 'loadout'>): readonly EquippedItem[] {
  return SLOTS.flatMap((slot) => {
    const item = hero.loadout[slot];
    return item ? [item] : [];
  });
}

export type RarityCount = {
  readonly rarity: RarityKey;
  readonly count: number;
};

export type EquippedGearAverages = {
  readonly itemCount: number;
  /** All absent when no squad hero wears anything — an average of nothing is not a zero. */
  readonly averageLevel?: number;
  readonly averageUpgrade?: number;
  readonly lowestLevel?: number;
  readonly highestLevel?: number;
};

export type RosterSummary = {
  /** Sum over the squad heroes whose power the read carried. */
  readonly squadPower: number;
  /** Rarest first, rarities nobody holds left out. Counts the whole roster, bench included. */
  readonly rarityCounts: readonly RarityCount[];
  readonly squadCount: number;
  readonly benchCount: number;
  readonly maxPhase?: number;
  readonly squadGear: EquippedGearAverages;
};

const RARITIES_RAREST_FIRST: readonly RarityKey[] = [...RARITIES].reverse();

function rarityCountsOf(heroes: readonly Pick<HeroRecord, 'rarity'>[]): readonly RarityCount[] {
  return RARITIES_RAREST_FIRST.map((rarity) => ({
    rarity,
    count: heroes.filter((hero) => hero.rarity === rarity).length,
  })).filter((entry) => entry.count > 0);
}

export function equippedGearAverages(
  heroes: readonly Pick<HeroRecord, 'loadout'>[],
): EquippedGearAverages {
  const items = heroes.flatMap(equippedItemsOf);
  if (items.length === 0) return { itemCount: 0 };
  const mean = (read: (item: EquippedItem) => number) =>
    items.reduce((total, item) => total + read(item), 0) / items.length;
  return {
    itemCount: items.length,
    averageLevel: mean((item) => item.level),
    averageUpgrade: mean((item) => item.upgrade),
    lowestLevel: Math.min(...items.map((item) => item.level)),
    highestLevel: Math.max(...items.map((item) => item.level)),
  };
}

/** `maxPhase` is the host's to give: the web planner may hold no account read that carries it. */
export function rosterSummaryFor(
  rows: readonly { readonly hero: HeroRecord }[],
  options: { readonly maxPhase?: number | null | undefined } = {},
): RosterSummary {
  const heroes = rows.map((row) => row.hero);
  const squad = heroes.filter(isSquadHero);
  return {
    squadPower: squad.reduce((total, hero) => total + (hero.power ?? 0), 0),
    rarityCounts: rarityCountsOf(heroes),
    squadCount: squad.length,
    benchCount: heroes.length - squad.length,
    ...(options.maxPhase == null ? {} : { maxPhase: options.maxPhase }),
    squadGear: equippedGearAverages(squad),
  };
}
