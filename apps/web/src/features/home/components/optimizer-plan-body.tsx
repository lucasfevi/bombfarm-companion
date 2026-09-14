import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { scoredPhaseHint, scoredPhaseValue } from '@bombfarm/team-plan/model';
import { cn, formatNumber } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import type { PlannerStore } from '@/shared/stores';
import { gainPct, type PlanActions } from '../model/optimizer-actions';
import { OptimizerActionRow } from './optimizer-action-row';

const FIRST_ACTIONS = 3;

function signedPct(plan: TeamPlan, lang: Lang): string {
  const value = gainPct(plan);
  const text = formatNumber(value, lang, 1);
  return value >= 0 ? `+${text}` : text;
}

export function OptimizerPlanBody({
  plan,
  actions,
  objective,
  t,
  lang,
}: {
  plan: TeamPlan;
  actions: PlanActions;
  objective: PlannerStore['objective'];
  t: Strings;
  lang: Lang;
}) {
  const headline = objective === 'farm' ? t.homeCardOptimizerHeadlineFarm : t.homeCardOptimizerHeadlineDps;
  const hint = scoredPhaseHint(t, plan);
  const scoredAt = sub(t.homeCardOptimizerScoredAt, { phase: scoredPhaseValue(lang, plan) });

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-base font-semibold tabular-nums" data-testid="home-optimizer-headline">
        {sub(headline, { pct: signedPct(plan, lang) })}
      </p>
      <p className={cn(mutedClass, 'm-0 text-xs')} data-testid="home-optimizer-scored-at">
        {hint === null ? scoredAt : `${scoredAt} · ${hint}`}
      </p>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {actions.rows.slice(0, FIRST_ACTIONS).map((row, index) => (
          <OptimizerActionRow key={index} row={row} />
        ))}
      </ul>
    </div>
  );
}
