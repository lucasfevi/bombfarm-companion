import { pickHeroAfterImport } from '@bombfarm/domain/pick-hero-after-import';
import type { HeroRecord } from '@/shared/lib/storage';

/**
 * Who the editor should be pointed at, never `null` for a non-empty roster: the hero asked for
 * when the roster still carries it, else the roster's strongest.
 *
 * One policy for "no hero to carry over", shared by the two places it arises. After an import of
 * a DIFFERENT account the edited hero is gone; left there, the draft autosave had nothing valid
 * to write and declined silently. At boot, a roster with no stored hero, or a stored hero the
 * roster no longer holds, opened the planner on a blank draft that no roster row could mark.
 */
export function pickHeroAfterImportOrStrongest(
  heroes: HeroRecord[],
  activeHeroId: string | null,
): HeroRecord | null {
  return pickHeroAfterImport(heroes, activeHeroId) ?? pickHeroAfterImport(heroes, null);
}
