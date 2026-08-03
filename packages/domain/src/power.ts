import { critFactor, fuseSeconds } from '@/shared/domain/model';
import type { SheetStats } from '@/shared/domain/gear';
import type { HeroRecord } from '@/shared/lib/storage';

/** The hero's current geared sheet — the one stat block the user types in. */
export function heroGearedSheet(hero: HeroRecord): SheetStats {
  return hero.gearedOverride;
}

/**
 * Relative power index for roster sorting: avg hit x bomb pace from the geared
 * sheet alone. Account-wide multipliers (tree/buffs/context) are identical for
 * every hero, so they cannot change the ordering and are deliberately left out.
 */
export function heroPowerIndex(hero: HeroRecord): number {
  const sheet = heroGearedSheet(hero);
  const pace = 1 / fuseSeconds(sheet.cdr);
  return sheet.attack * critFactor(sheet.critChance, sheet.critDmg) * pace;
}
