import { shouldShowEmptyState } from '@/shared/lib/storage';
import { formatNumber } from '@/shared/lib/format-number';
import type { PlannerStore } from '@/shared/stores/planner-store';

export const selectHeroName = (state: PlannerStore) => state.heroName;
export const selectHeroRarity = (state: PlannerStore) => state.rarity;
export const selectHeroLevel = (state: PlannerStore) => state.level;
export const selectHeroStars = (state: PlannerStore) => state.stars;
export const selectHeroSourceId = (state: PlannerStore) => state.heroSourceId;
export const selectHeroRank = (state: PlannerStore) => state.heroRank;
export const selectHeroBattleAllowed = (state: PlannerStore) => state.heroBattleAllowed;
export const selectHeroSkin = (state: PlannerStore) => state.heroSkin;
export const selectHeroStatPointsAvailable = (state: PlannerStore) => state.statPointsAvailable;

export const selectShouldShowEmptyState = (state: PlannerStore) =>
  shouldShowEmptyState(state.heroes.length);

export const selectFormatNumber = () => formatNumber;
