'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
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
    <div className="mt-3 space-y-2 text-[13px] text-muted" role="status">
      <div>
        <strong className="text-ink">{t.gearPlanRunSummaryRegime}:</strong> {regimeLabel}
      </div>
      <div>
        <strong className="text-ink">{t.gearPlanRunSummaryDuty}:</strong>{' '}
        {formatNumber(plan.sumDuty, 2)} / {plan.slots}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <span>
          {t.gearPlanRunSummaryRounds}: {plan.run.rounds}
        </span>
        <span>
          {t.gearPlanRunSummaryEvals}: {plan.run.evaluations}
        </span>
        <span>
          {t.gearPlanRunSummaryElapsed}: {plan.run.elapsedMs} ms
        </span>
      </div>
      {plan.run.budgetExhausted ? (
        <p className="m-0 text-warn">{t.gearPlanBudgetExhausted}</p>
      ) : null}
      {ranOnMainThread ? <p className="m-0">{t.gearPlanMainThreadFallback}</p> : null}
      <p className="m-0 text-[11px]">
        {sub(t.gearPlanRunMetaFooter, {
          rounds: String(plan.run.rounds),
          evals: String(plan.run.evaluations),
          elapsed: String(plan.run.elapsedMs),
          seed: plan.run.seedUsed,
        })}
      </p>
    </div>
  );
}
