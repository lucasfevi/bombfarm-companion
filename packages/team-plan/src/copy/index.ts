/**
 * `@bombfarm/team-plan/copy` — user-facing strings for the optimizer screen.
 *
 * Three part dictionaries, one per language, merged here. Never widen a dictionary's type with
 * `as`, `satisfies`, or an index signature: each of those defeats the "a missing key is a compile
 * error naming the key" guarantee the plain value-widening annotation gives — see `pt-BR.ts`'s
 * header comment for the full argument.
 */
import { teamPlanPageEn } from './en';
import { teamPlanPagePtBR } from './pt-BR';
import { teamPlanObjectivePairsEn } from './objective-en';
import { teamPlanObjectivePairsPtBR } from './objective-pt-BR';
import { teamPlanGearFlowEn } from './gear-flow-en';
import { teamPlanGearFlowPtBR } from './gear-flow-pt-BR';
import type { Lang } from '@bombfarm/hero/copy';
import type { TeamPlanHostCopy } from './host-copy';

export { teamPlanPageEn } from './en';
export { teamPlanPagePtBR } from './pt-BR';
export { teamPlanObjectivePairsEn } from './objective-en';
export { teamPlanObjectivePairsPtBR } from './objective-pt-BR';
export { teamPlanGearFlowEn } from './gear-flow-en';
export { teamPlanGearFlowPtBR } from './gear-flow-pt-BR';
export type { TeamPlanHostCopy } from './host-copy';
export { parseEmphasis } from './format';

export type TeamPlanPageCopy = { readonly [K in keyof typeof teamPlanPageEn]: string };
export type TeamPlanObjectivePairsCopy = {
  readonly [K in keyof typeof teamPlanObjectivePairsEn]: string;
};
export type TeamPlanGearFlowCopy = { readonly [K in keyof typeof teamPlanGearFlowEn]: string };

export const teamPlanEn = {
  ...teamPlanPageEn,
  ...teamPlanObjectivePairsEn,
  ...teamPlanGearFlowEn,
} as const;

export const teamPlanPtBR: TeamPlanCopy = {
  ...teamPlanPagePtBR,
  ...teamPlanObjectivePairsPtBR,
  ...teamPlanGearFlowPtBR,
};

export type TeamPlanCopy = { readonly [K in keyof typeof teamPlanEn]: string };
export type TeamPlanCopyKey = keyof TeamPlanCopy;

/** What the screen takes: the package's own dictionary plus every host-owned string. */
export type TeamPlanScreenCopy = TeamPlanCopy & TeamPlanHostCopy;

export const TEAM_PLAN_STRINGS: Record<Lang, TeamPlanCopy> = { en: teamPlanEn, pt: teamPlanPtBR };

export function teamPlanCopyFor(lang: Lang): TeamPlanCopy {
  return TEAM_PLAN_STRINGS[lang];
}
