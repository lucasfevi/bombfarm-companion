'use client';

import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { Panel } from '@bombfarm/ui';
import { mutedClass, panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings, Lang } from '@/shared/i18n';
import { parseEmphasis, sub } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';

function formatElapsedSeconds(elapsedMs: number, lang: Lang): string {
  return formatNumber(elapsedMs / 1000, lang, 1);
}

function seedStartLabel(strings: Strings, seedUsed: string): string {
  switch (seedUsed) {
    case 'current':
      return strings.teamPlanRunSeedCurrent;
    case 'greedyHeroDps':
      return strings.teamPlanRunSeedGreedyHeroDps;
    case 'greedySlotValue':
      return strings.teamPlanRunSeedGreedySlotValue;
    case 'bestItemFirst':
      return strings.teamPlanRunSeedBestItemFirst;
    default:
      return strings.teamPlanRunSeedFallback;
  }
}

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
}: {
  t: Strings;
  lang: Lang;
  plan: TeamPlan;
  ranOnMainThread: boolean;
}) {
  const saturated = plan.regime === 'saturated';
  const regimeLabel = saturated ? t.teamPlanRegimeSaturated : t.teamPlanRegimeUnderSaturated;
  const regimeHint = saturated
    ? t.teamPlanRunSummaryRegimeHintSaturated
    : t.teamPlanRunSummaryRegimeHintUnder;

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
        {plan.run.budgetExhausted ? (
          <p className="m-0 text-warn">{t.teamPlanBudgetExhausted}</p>
        ) : null}
        {ranOnMainThread ? <p className={`m-0 ${mutedClass}`}>{t.teamPlanMainThreadFallback}</p> : null}
      </div>
    </Panel>
  );
}
