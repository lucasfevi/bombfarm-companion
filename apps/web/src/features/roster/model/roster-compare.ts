import { SLOTS } from '@bombfarm/domain/gear';
import type { HeroRecord } from '@/shared/lib/storage';
import { raritySortIdx, rankSortIdx } from '@bombfarm/domain/roster-sort';
import { heroGearedSheet } from '@bombfarm/domain/power';
import type { RosterSortDir, RosterSortKey } from '../components/roster-sort-header';

export function gearCountOf(hero: HeroRecord): number {
  return SLOTS.filter((slot) => hero.loadout[slot]).length;
}

function compareByKey(
  left: HeroRecord,
  right: HeroRecord,
  key: RosterSortKey,
  powerById: Map<string, number>,
): number {
  switch (key) {
    case 'rank':
      return rankSortIdx(left.rank) - rankSortIdx(right.rank);
    case 'name':
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
    case 'rarity':
      return raritySortIdx(left.rarity) - raritySortIdx(right.rarity);
    case 'level':
      return left.level - right.level;
    case 'power':
      return (
        (left.power ?? powerById.get(left.id) ?? 0) - (right.power ?? powerById.get(right.id) ?? 0)
      );
    case 'gear':
      return gearCountOf(left) - gearCountOf(right);
    case 'updated':
      return left.updatedAt - right.updatedAt;
    default:
      return heroGearedSheet(left)[key] - heroGearedSheet(right)[key];
  }
}

export function compareRosterHeroes(
  left: HeroRecord,
  right: HeroRecord,
  key: RosterSortKey,
  sortDirection: RosterSortDir,
  powerById: Map<string, number>,
): number {
  const direction = sortDirection === 'asc' ? 1 : -1;
  const comparison = compareByKey(left, right, key, powerById);
  if (comparison !== 0) return comparison * direction;
  return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
}
