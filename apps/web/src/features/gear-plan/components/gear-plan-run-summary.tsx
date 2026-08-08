'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { Panel } from '@bombfarm/ui';
import { mutedClass, panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { parseEmphasis, sub } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';

function formatElapsedSeconds(ms: number): string {
  return formatNumber(ms / 1000, 1);
}

function seedStartLabel(t: Strings, seedUsed: string): string {
  switch (seedUsed) {
    case 'current':
      return t.gearPlanRunSeedCurrent;
    case 'greedyHeroDps':
      return t.gearPlanRunSeedGreedyHeroDps;
    case 'greedySlotValue':
      return t.gearPlanRunSeedGreedySlotValue;
    case 'bestItemFirst':
      return t.gearPlanRunSeedBestItemFirst;
    default:
      return t.gearPlanRunSeedFallback;
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

export function GearPlanRunSummary({
  t,
  plan,
  ranOnMainThread,
}: {
  t: Strings;
  plan: GearPlan;
  ranOnMainThread: boolean;
}) {
  const saturated = plan.regime === 'saturated';
  const regimeLabel = saturated ? t.gearPlanRegimeSaturated : t.gearPlanRegimeUnderSaturated;
  const regimeHint = saturated
    ? t.gearPlanRunSummaryRegimeHintSaturated
    : t.gearPlanRunSummaryRegimeHintUnder;

  const metaLine = sub(t.gearPlanRunMetaFooter, {
    seconds: formatElapsedSeconds(plan.run.elapsedMs),
    rounds: String(plan.run.rounds),
    evals: formatNumber(plan.run.evaluations, 0),
    seed: seedStartLabel(t, plan.run.seedUsed),
  });

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanRunSummaryTitle}</h2>
      </div>
      <div className="space-y-3 text-[13px]" role="status">
        <div>
          <p className="m-0 text-ink">
            <strong>{t.gearPlanRunSummaryFieldStatus}:</strong> {regimeLabel}
          </p>
          <p className={`m-0 mt-1 ${mutedClass}`}>{regimeHint}</p>
        </div>
        <div>
          <p className="m-0 text-ink">
            <strong>{t.gearPlanRunSummaryDuty}:</strong>{' '}
            {sub(t.gearPlanRunSummaryDutyValue, {
              duty: formatNumber(plan.sumDuty, 2),
              slots: String(plan.slots),
            })}
          </p>
          <p className={`m-0 mt-1 ${mutedClass}`}>{t.gearPlanRunSummaryDutyHint}</p>
        </div>
        <p className={`m-0 ${mutedClass}`}>{emphasizedLine(metaLine)}</p>
        {plan.run.budgetExhausted ? (
          <p className="m-0 text-warn">{t.gearPlanBudgetExhausted}</p>
        ) : null}
        {ranOnMainThread ? <p className={`m-0 ${mutedClass}`}>{t.gearPlanMainThreadFallback}</p> : null}
      </div>
    </Panel>
  );
}
