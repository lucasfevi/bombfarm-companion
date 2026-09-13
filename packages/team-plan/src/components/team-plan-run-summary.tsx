'use client';

import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { Panel, formatNumber, mutedClass, panelHClass, panelTitleClass } from '@bombfarm/ui';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanCopy } from '../copy';
import { parseEmphasis } from '../copy';
import type { TeamPlanObjectiveCopy } from '../model/objective-copy';
import { formatElapsedSeconds, scoredPhaseHint, seedStartLabel } from '../model/run-summary-copy';

function emphasizedLine(text: string) {
  return parseEmphasis(text).map((part, index) =>
    part.kind === 'em' ? (
      <strong key={index} className="font-semibold text-ink">
        {part.value}
      </strong>
    ) : (
      <span key={index}>{part.value}</span>
    ),
  );
}

export function TeamPlanRunSummary({
  t,
  lang,
  plan,
  ranOnMainThread,
  copy,
}: {
  t: TeamPlanCopy;
  lang: Lang;
  plan: TeamPlan;
  ranOnMainThread: boolean;
  copy: TeamPlanObjectiveCopy;
}) {
  const saturated = plan.regime === 'saturated';
  const regimeLabel = saturated ? t.teamPlanRegimeSaturated : t.teamPlanRegimeUnderSaturated;
  const regimeHint = saturated
    ? copy.regimeHintSaturated
    : t.teamPlanRunSummaryRegimeHintUnder;

  const phaseHint = scoredPhaseHint(t, lang, plan);

  const metaLine = sub(t.teamPlanRunMetaFooter, {
    seconds: formatElapsedSeconds(plan.run.elapsedMs, lang),
    rounds: String(plan.run.rounds),
    evals: formatNumber(plan.run.evaluations, lang, 0),
    seed: seedStartLabel(t, plan.run.seedUsed),
  });

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.teamPlanRunSummaryTitle}</h2>
      </div>
      <div className="space-y-3 text-[13px]" role="status">
        {phaseHint ? (
          <p className={`m-0 ${plan.scoredPhaseInfeasible ? 'text-warn' : 'text-ink'}`}>
            <strong>{t.teamPlanRunSummaryScoredPhase}:</strong> {phaseHint}
          </p>
        ) : null}
        <div>
          <p className="m-0 text-ink">
            <strong>{t.teamPlanRunSummaryFieldStatus}:</strong> {regimeLabel}
          </p>
          <p className={`m-0 mt-1 ${mutedClass}`}>{regimeHint}</p>
        </div>
        <div>
          <p className="m-0 text-ink">
            <strong>{t.teamPlanRunSummaryDuty}:</strong>{' '}
            {sub(t.teamPlanRunSummaryDutyValue, {
              duty: formatNumber(plan.sumDuty, lang, 2),
              slots: String(plan.slots),
            })}
          </p>
          <p className={`m-0 mt-1 ${mutedClass}`}>{t.teamPlanRunSummaryDutyHint}</p>
        </div>
        <p className={`m-0 ${mutedClass}`}>{emphasizedLine(metaLine)}</p>
        {plan.runedHeroNames.length > 0 ? (
          <p className={`m-0 ${mutedClass}`}>
            {sub(t.teamPlanRunedHeroes, { heroes: plan.runedHeroNames.join(', ') })}
          </p>
        ) : null}
        {plan.run.budgetExhausted ? (
          <p className="m-0 text-warn">{t.teamPlanBudgetExhausted}</p>
        ) : null}
        {ranOnMainThread ? <p className={`m-0 ${mutedClass}`}>{t.teamPlanMainThreadFallback}</p> : null}
      </div>
    </Panel>
  );
}
