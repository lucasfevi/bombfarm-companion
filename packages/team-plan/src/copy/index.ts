/**
 * `@bombfarm/team-plan/copy` — user-facing strings for the optimizer screen.
 *
 * Four part dictionaries, one per language, merged here. Never widen a dictionary's type with
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
import { teamPlanChangesEn } from './changes-en';
import { teamPlanChangesPtBR } from './changes-pt-BR';
import type { Lang, RosterCopy, StatPanelCopy } from '@bombfarm/hero/copy';
import type { TeamPlanHostCopy } from './host-copy';

export { teamPlanPageEn } from './en';
export { teamPlanPagePtBR } from './pt-BR';
export { teamPlanObjectivePairsEn } from './objective-en';
export { teamPlanObjectivePairsPtBR } from './objective-pt-BR';
export { teamPlanGearFlowEn } from './gear-flow-en';
export { teamPlanGearFlowPtBR } from './gear-flow-pt-BR';
export { teamPlanChangesEn } from './changes-en';
export { teamPlanChangesPtBR } from './changes-pt-BR';
export type { TeamPlanHostCopy } from './host-copy';
export { parseEmphasis } from './format';

export type TeamPlanPageCopy = { readonly [K in keyof typeof teamPlanPageEn]: string };
export type TeamPlanObjectivePairsCopy = {
  readonly [K in keyof typeof teamPlanObjectivePairsEn]: string;
};
export type TeamPlanGearFlowCopy = { readonly [K in keyof typeof teamPlanGearFlowEn]: string };
export type TeamPlanChangesCopy = { readonly [K in keyof typeof teamPlanChangesEn]: string };

export const teamPlanEn = {
  ...teamPlanPageEn,
  ...teamPlanObjectivePairsEn,
  ...teamPlanGearFlowEn,
  ...teamPlanChangesEn,
} as const;

export const teamPlanPtBR: TeamPlanCopy = {
  ...teamPlanPagePtBR,
  ...teamPlanObjectivePairsPtBR,
  ...teamPlanGearFlowPtBR,
  ...teamPlanChangesPtBR,
};

export type TeamPlanCopy = { readonly [K in keyof typeof teamPlanEn]: string };
export type TeamPlanCopyKey = keyof TeamPlanCopy;

/**
 * What the screen takes: the package's own dictionary, every host-owned string, and the
 * hero-identity/stat-panel vocabulary the per-hero breakdown panels read from deep in the tree
 * (`RosterCopy` for a hero's rank/rarity chip, `StatPanelCopy` for the shared stat-table labels)
 * — the same two contracts `@bombfarm/hero`'s own panels take, so a host that already draws the
 * Heroes screen supplies nothing new here.
 */
export type TeamPlanScreenCopy = TeamPlanCopy & TeamPlanHostCopy & RosterCopy & StatPanelCopy;

export const TEAM_PLAN_STRINGS: Record<Lang, TeamPlanCopy> = { en: teamPlanEn, pt: teamPlanPtBR };

export function teamPlanCopyFor(lang: Lang): TeamPlanCopy {
  return TEAM_PLAN_STRINGS[lang];
}
