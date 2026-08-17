import {
  deleteHero,
  saveHeroes,
  setActiveHeroId as writeActiveHeroIdStorage,
  type HeroRecord,
} from '@/shared/lib/storage';

export function writeRoster(heroes: HeroRecord[]): void {
  saveHeroes(heroes);
}

export function writeActiveHeroId(heroId: string | null): void {
  writeActiveHeroIdStorage(heroId);
}

export function writeRosterAfterDelete(heroes: HeroRecord[], heroId: string): HeroRecord[] {
  return deleteHero(heroes, heroId);
}

/** Persist a planner enable/disable toggle (`battleAllowed`) without touching the active pointer. */
export function writeHeroBattleAllowed(
  heroes: HeroRecord[],
  heroId: string,
  battleAllowed: boolean,
): HeroRecord[] {
  const existingIndex = heroes.findIndex((hero) => hero.id === heroId);
  if (existingIndex < 0) return heroes;
  if ((heroes[existingIndex].battleAllowed ?? true) === battleAllowed) return heroes;
  const next = [...heroes];
  next[existingIndex] = { ...next[existingIndex], battleAllowed };
  saveHeroes(next);
  return next;
}
