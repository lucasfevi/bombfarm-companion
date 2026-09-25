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

export type SummaryHero = {
  readonly id: string;
  readonly name: string;
  readonly power: number;
};

export type RarityCount = {
  readonly rarity: RarityKey;
  readonly count: number;
};

export type EquippedGearAverages = {
  readonly itemCount: number;
  /** Both absent when no squad hero wears anything — an average of nothing is not a zero. */
  readonly averageLevel?: number;
  readonly averageUpgrade?: number;
};

export type RosterSummary = {
  /** Sum over the squad heroes whose power the read carried. */
  readonly squadPower: number;
  readonly topSquadHeroes: readonly SummaryHero[];
  /** Rarest first, rarities nobody holds left out. Counts the whole roster, bench included. */
  readonly rarityCounts: readonly RarityCount[];
  readonly squadCount: number;
  readonly benchCount: number;
  readonly maxPhase?: number;
  readonly squadGear: EquippedGearAverages;
};

const TOP_SQUAD_HEROES = 3;

const RARITIES_RAREST_FIRST: readonly RarityKey[] = [...RARITIES].reverse();

function byPowerThenId(left: SummaryHero, right: SummaryHero): number {
  return right.power - left.power || left.id.localeCompare(right.id);
}

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
  };
}

/** `maxPhase` is the host's to give: the web planner may hold no account read that carries it. */
export function rosterSummaryFor(
  rows: readonly { readonly hero: HeroRecord }[],
  options: { readonly maxPhase?: number | null | undefined } = {},
): RosterSummary {
  const heroes = rows.map((row) => row.hero);
  const squad = heroes.filter(isSquadHero);
  const powered = squad.flatMap((hero) =>
    hero.power == null ? [] : [{ id: hero.id, name: hero.name, power: hero.power }],
  );
  return {
    squadPower: powered.reduce((total, hero) => total + hero.power, 0),
    topSquadHeroes: [...powered].sort(byPowerThenId).slice(0, TOP_SQUAD_HEROES),
    rarityCounts: rarityCountsOf(heroes),
    squadCount: squad.length,
    benchCount: heroes.length - squad.length,
    ...(options.maxPhase == null ? {} : { maxPhase: options.maxPhase }),
    squadGear: equippedGearAverages(squad),
  };
}
