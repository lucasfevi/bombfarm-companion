import { WIKI_PHASE_LINES } from '@bombfarm/domain/phase-wiki';
import type { SearchSelectOption } from '@bombfarm/ui';
import type { Lang } from '@bombfarm/hero/copy';
import { formatPhaseLabel } from './phase-label';

/**
 * Every phase, labelled the way the game names it — `Normal 1-1 (#51)`, the app's one spelling
 * (`formatPhaseLabel`).
 *
 * The label is also the whole search surface, which is why it carries the difficulty word, the
 * coordinate AND the number: those are the three things a player knows a phase by, and each is
 * matched by `SearchSelect` against this one string. The wiki's flavour names are deliberately
 * absent — they diverge from the client past world 2, so a search that found a phase by one would
 * be finding it by a name the game does not use.
 */
export function phaseSearchOptions(lang: Lang): SearchSelectOption[] {
  return WIKI_PHASE_LINES.map((line) => ({
    value: String(line.phase),
    label: formatPhaseLabel(line.phase, lang),
  }));
}

/** The control's string value for a phase, and back. */
export function phaseSearchValue(phase: number): string {
  return String(phase);
}

export function phaseFromSearchValue(value: string): number | null {
  const phase = Number.parseInt(value, 10);
  return Number.isFinite(phase) ? phase : null;
}
