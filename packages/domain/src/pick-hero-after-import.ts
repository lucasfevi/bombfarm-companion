import type { HeroRecord } from './shims/storage';

/** Which hero the editor should load after a save import merges into storage. */
export function pickHeroAfterImport(
  merged: HeroRecord[],
  heroId: string | null,
): HeroRecord | null {
  if (heroId) {
    return merged.find((hero) => hero.id === heroId) ?? null;
  }
  if (merged.length === 0) return null;
  return merged.reduce((best, hero) => ((hero.power ?? 0) > (best.power ?? 0) ? hero : best));
}
