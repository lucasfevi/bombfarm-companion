import type { PlannerStore } from '@/shared/stores/planner-store';
import type { HeroRecord } from '@/shared/lib/storage';

export const selectHeroes = (state: PlannerStore): HeroRecord[] => state.heroes;
export const selectActiveHeroId = (state: PlannerStore): string | null => state.activeHeroId;
export const selectActiveHero = (state: PlannerStore): HeroRecord | undefined =>
  state.heroes.find((hero) => hero.id === state.activeHeroId);
