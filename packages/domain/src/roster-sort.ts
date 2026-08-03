import type { RarityKey } from '@/shared/domain/model';
import { RANK_ORDER, RARITIES } from '@/shared/domain/planner-constants';

export function raritySortIdx(rarity: RarityKey): number {
  const index = RARITIES.indexOf(rarity);
  return index >= 0 ? index : 0;
}

export function rankSortIdx(rank: string | null | undefined): number {
  if (!rank) return RANK_ORDER.length;
  const index = RANK_ORDER.indexOf(rank.toUpperCase() as (typeof RANK_ORDER)[number]);
  return index >= 0 ? index : RANK_ORDER.length;
}
