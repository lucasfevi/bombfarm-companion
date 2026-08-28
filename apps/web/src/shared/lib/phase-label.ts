import { formatPhaseCoord } from '@bombfarm/domain/phase-wiki';

/**
 * A phase as the game names it, e.g. `Normal 1-1 (#51)` — the in-game difficulty + map
 * coordinate, not the wiki flavour name `phase-fact-items.tsx`'s `mapName` shows.
 *
 * Lives in `shared/lib` rather than in the Phases feature because the Account page's header
 * prints the same label for the account's current and furthest phase, and cross-feature imports
 * are denied. One definition, so the two surfaces cannot drift into different spellings
 * of the same phase.
 *
 * `@bombfarm/domain`'s own `formatPhaseLabel` renders the number WITHOUT the `#`
 * (`Hard 1-1 (151)`); this wraps the same `formatPhaseCoord` rather than that helper so the app
 * can keep the `#`.
 *
 * `lang` is spelled as the literal union rather than imported as `Lang`: `shared-lib` has no
 * policy allowing a dependency on `shared-i18n`, and this is the same union `@bombfarm/domain`'s
 * own phase formatters declare, so the two stay structurally identical.
 */
export function formatPhaseLabel(phase: number, lang: 'en' | 'pt'): string {
  return `${formatPhaseCoord(phase, lang)} (#${phase})`;
}
