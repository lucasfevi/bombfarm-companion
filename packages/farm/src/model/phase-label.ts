import { formatPhaseCoord } from '@bombfarm/domain/phase-wiki';
import type { Lang } from '@bombfarm/hero/copy';

/**
 * A phase as the game names it, e.g. `Normal 1-1 (#51)` — the in-game difficulty + map
 * coordinate, not the wiki flavour name `phase-fact-items.tsx`'s `mapName` shows.
 *
 * ONE definition, deliberately: the Account page's header prints the same label for the account's
 * current and furthest phase, and the farm board prints it in its phase column. Two definitions
 * would drift into different spellings of the same phase.
 *
 * `@bombfarm/domain`'s own `formatPhaseLabel` renders the number WITHOUT the `#`
 * (`Hard 1-1 (151)`); this wraps the same `formatPhaseCoord` rather than that helper so the app
 * can keep the `#`.
 */
export function formatPhaseLabel(phase: number, lang: Lang): string {
  return `${formatPhaseCoord(phase, lang)} (#${phase})`;
}
