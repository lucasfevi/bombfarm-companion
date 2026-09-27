import type { TreeSheetTotals } from '@bombfarm/domain/birth-sheet';
import { emptyLoadout, type EquippedItem, type SheetStats } from '@bombfarm/domain/gear';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { RosterHeroRow } from './roster-rows';
import { rollQualityFor } from '@bombfarm/domain/roll-quality';

export const ZERO_SHEET: SheetStats = {
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
};

export const NEUTRAL_TREE: TreeSheetTotals = {
  danoStatic: 1,
  energyPct: 0,
  speedPct: 0,
  critChancePct: 0,
  critDmgPct: 0,
  luckFlatPct: 0,
};

export function heroFixture(
  partial: Partial<HeroRecord> & Pick<HeroRecord, 'id'>,
): HeroRecord {
  return {
    name: partial.id,
    updatedAt: 0,
    rarity: 'Raro',
    level: 50,
    stars: 0,
    naked: ZERO_SHEET,
    loadout: emptyLoadout(),
    altLoadout: null,
    gearedOverride: ZERO_SHEET,
    abilities: {},
    pts: ZERO_SHEET,
    ...partial,
  };
}

export function rowFixture(partial: Partial<HeroRecord> & Pick<HeroRecord, 'id'>): RosterHeroRow {
  const hero = heroFixture(partial);
  return { id: hero.id, hero, report: rollQualityFor(hero) };
}

export function item(level: number, upgrade: number, defId = 'ember_arma'): EquippedItem {
  return { defId, rarityIdx: 2, level, upgrade };
}
