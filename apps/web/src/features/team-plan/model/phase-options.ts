import { phaseSearchOptions } from '@bombfarm/farm';
import type { SearchSelectOption } from '@bombfarm/ui';
import type { Lang } from '@/shared/i18n';

/**
 * "None" is a real option with a real value, not the absence of one: a picker whose only way back
 * to "let the search decide" is clearing a text field is a picker the player cannot use.
 */
export const TEAM_PLAN_PHASE_NONE = '';

/** Every phase under the app's one phase spelling (`phaseSearchOptions`), behind a "None" row. */
export function teamPlanPhaseOptions(lang: Lang, noneLabel: string): SearchSelectOption[] {
  return [{ value: TEAM_PLAN_PHASE_NONE, label: noneLabel }, ...phaseSearchOptions(lang)];
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
