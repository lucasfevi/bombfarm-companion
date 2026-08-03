import {
  deleteHero,
  importHeroes,
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

export function writeImportedRoster(
  heroes: HeroRecord[],
  records: (Omit<HeroRecord, 'id' | 'updatedAt'> & { sourceId: string })[],
  saveSourceIds?: ReadonlySet<string>,
) {
  return importHeroes(heroes, records, saveSourceIds);
}

export function writeRosterAfterDelete(heroes: HeroRecord[], heroId: string): HeroRecord[] {
  return deleteHero(heroes, heroId);
}
