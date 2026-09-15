import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { scoredPhaseHint, scoredPhaseValue } from '@bombfarm/team-plan/model';
import { cn, formatNumber } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { PlannerStore } from '@/shared/stores';
import { gainPct } from '../model/optimizer-gain';

function signedPct(plan: TeamPlan, lang: Lang): string {
  const value = gainPct(plan);
  const text = formatNumber(value, lang, 1);
  return value >= 0 ? `+${text}` : text;
}

export function OptimizerPlanBody({
  plan,
  objective,
  t,
  lang,
}: {
  plan: TeamPlan;
  objective: PlannerStore['objective'];
  t: Strings;
  lang: Lang;
}) {
  const headline = objective === 'farm' ? t.homeCardOptimizerHeadlineFarm : t.homeCardOptimizerHeadlineDps;
  const hint = scoredPhaseHint(t, plan);
  const scoredAt = sub(t.homeCardOptimizerScoredAt, { phase: scoredPhaseValue(lang, plan) });

  return (
    <>
      <p className="m-0 flex flex-col" data-testid="home-optimizer-headline">
        <span className="text-4xl font-bold leading-none text-up" data-testid="home-optimizer-gain">
          {signedPct(plan, lang)}%
        </span>{' '}
        <span className="text-sm text-ink">{headline}</span>
      </p>
      <p className={cn(mutedClass, 'm-0 text-xs')} data-testid="home-optimizer-scored-at">
        {hint === null ? scoredAt : `${scoredAt} · ${hint}`}
      </p>
    </>
  );
}
