import { WIKI_PHASE_LINES } from '@bombfarm/domain/phase-wiki';
import type { SearchSelectOption } from '@bombfarm/ui';
import { formatPhaseLabel } from '@/shared/lib/phase-label';
import type { Lang } from '@/shared/i18n';

/**
 * "None" is a real option with a real value, not the absence of one: a picker whose only way back
 * to "let the search decide" is clearing a text field is a picker the player cannot use.
 */
export const TEAM_PLAN_PHASE_NONE = '';

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
export function teamPlanPhaseOptions(lang: Lang, noneLabel: string): SearchSelectOption[] {
  const phases = WIKI_PHASE_LINES.map((line) => ({
    value: String(line.phase),
    label: formatPhaseLabel(line.phase, lang),
  }));
  return [{ value: TEAM_PLAN_PHASE_NONE, label: noneLabel }, ...phases];
}

/** The control's string value for a stored phase, and back. */
export function phaseOptionValue(phase: number | null): string {
  return phase == null ? TEAM_PLAN_PHASE_NONE : String(phase);
}

export function phaseFromOptionValue(value: string): number | null {
  if (value === TEAM_PLAN_PHASE_NONE) return null;
  const phase = Number.parseInt(value, 10);
  return Number.isFinite(phase) ? phase : null;
}
