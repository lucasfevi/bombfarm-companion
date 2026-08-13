/**
 * `PlanningModel` + a hero id → `HeroAdvice | Withheld` (design.md §4.3, §7.1). The **only**
 * caller of `pipelineForHero` in the desktop tree (MPV-21) — `computeAdvisorPipeline` is never
 * assembled here or anywhere else under `apps/desktop`.
 */
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import { isQuantityUsable, withheldSections } from './account-model';
import type { HeroAdvice, PlanningModel, Withheld } from './types';

/**
 * `dps`, `nextPointRanking` and `resetAdvice` share one requirement set (`ADVICE_REQUIRES`) and
 * come from a single `pipelineForHero` call, so they are gated and computed together here. A
 * caller rendering a `nextPointRanking`- or `resetAdvice`-specific notice supplies its own
 * `quantity` to `withheldSections`/`ADVICE_REQUIRES` for that testid — the underlying gate is
 * identical, so this never disagrees with it.
 */
export function adviceForHero(model: PlanningModel, heroId: string): HeroAdvice | Withheld {
  const entry = model.heroes.find((candidate) => candidate.hero.id === heroId);
  if (!entry) {
    // A caller asking for a hero not in this model's own roster is a wiring bug, not an
    // account-data problem — fail loudly rather than fabricate a Withheld that looks legitimate
    // (design §10: no try/catch around pipelineForHero for the same reason).
    throw new Error(`adviceForHero: heroId "${heroId}" is not in this PlanningModel's roster`);
  }

  const withhold = (): Withheld => ({
    withheld: true,
    quantity: 'dps',
    sections: withheldSections(model.sections, 'dps'),
  });

  if (!isQuantityUsable(model.sections, 'dps') || entry.blocked) {
    return withhold();
  }

  const { shared, phase, mitigationPct } = model;
  if (shared === null || phase === null || mitigationPct === null) {
    return withhold();
  }

  const result = pipelineForHero(entry.hero, shared, phase, mitigationPct);
  return {
    withheld: false,
    dps: result.dps,
    ranking: result.ranking,
    best: result.best,
    resetAdvice: result.resetAdvice,
  };
}
