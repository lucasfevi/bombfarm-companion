'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';

export function GearPlanRunSummary({
  t,
  plan,
  ranOnMainThread,
}: {
  t: Strings;
  plan: GearPlan;
  ranOnMainThread: boolean;
}) {
  const regimeLabel =
    plan.regime === 'saturated' ? t.gearPlanRegimeSaturated : t.gearPlanRegimeUnderSaturated;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanRunSummaryTitle}</h2>
      </div>
      <div className="space-y-2 text-[13px] text-muted" role="status">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <strong className="text-ink">{t.gearPlanRunSummaryRegime}:</strong> {regimeLabel}
          </span>
          <span>
            <strong className="text-ink">{t.gearPlanRunSummaryDuty}:</strong>{' '}
            {formatNumber(plan.sumDuty, 2)} / {plan.slots}
          </span>
        </div>
        <p className="m-0 text-[12px]">
          {sub(t.gearPlanRunMetaFooter, {
            rounds: String(plan.run.rounds),
            evals: String(plan.run.evaluations),
            elapsed: String(plan.run.elapsedMs),
            seed: plan.run.seedUsed,
          })}
        </p>
        {plan.run.budgetExhausted ? (
          <p className="m-0 text-warn">{t.gearPlanBudgetExhausted}</p>
        ) : null}
        {ranOnMainThread ? <p className="m-0">{t.gearPlanMainThreadFallback}</p> : null}
      </div>
    </Panel>
  );
}
