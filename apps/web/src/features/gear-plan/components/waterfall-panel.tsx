'use client';

import type { GearPlan as DomainGearPlan, WaterfallStep } from '@bombfarm/domain/gear-plan/types';
import { MetricScoreboard, Panel, type MetricScoreboardCell } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';

const stepLabels: Record<WaterfallStep['id'], (strings: Strings) => string> = {
  today: (strings) => strings.gearPlanStepToday,
  forged: (strings) => strings.gearPlanStepForged,
  moved: (strings) => strings.gearPlanStepMoved,
  respec: (strings) => strings.gearPlanStepRespec,
};

export function WaterfallPanel({ t, plan }: { t: Strings; plan: DomainGearPlan }) {
  const totalDelta = plan.planDps - plan.currentDps;
  const totalPct = plan.currentDps > 0 ? (totalDelta / plan.currentDps) * 100 : 0;
  const totalSign = totalDelta >= 0 ? '+' : '';
  const pctSign = totalPct >= 0 ? '+' : '';

  const cells: MetricScoreboardCell[] = plan.steps.map((step) => {
    const showDelta = step.id !== 'today' && step.delta !== 0;
    return {
      id: step.id,
      label: stepLabels[step.id](t),
      value: formatNumber(step.objective, 0),
      delta: showDelta
        ? `${step.delta >= 0 ? '+' : ''}${formatNumber(step.delta, 0)}`
        : null,
      deltaTone: step.delta < 0 ? 'down' : 'up',
    };
  });

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanWaterfallTitle}</h2>
        <p className="m-0 text-[12px] font-normal text-muted">{t.gearPlanResultsHeader}</p>
      </div>
      <div className="mb-3 border-b border-line pb-3">
        <p className="m-0 text-[11px] tracking-wide text-muted uppercase">{t.gearPlanTotalGainLabel}</p>
        <p
          className={`m-0 mt-1 text-2xl leading-tight font-black tracking-tight tabular-nums ${totalDelta < 0 ? 'text-down' : 'text-up'}`}
        >
          {sub(t.gearPlanTotalGainValue, {
            delta: `${totalSign}${formatNumber(totalDelta, 0)}`,
            pct: `${pctSign}${formatNumber(totalPct, 1)}`,
          })}
        </p>
        <p className="m-0 mt-1 text-[12px] text-muted">
          {t.gearPlanCurrentDps}: {formatNumber(plan.currentDps, 0)} → {t.gearPlanPlanDps}:{' '}
          {formatNumber(plan.planDps, 0)}
        </p>
      </div>
      <MetricScoreboard aria-label={t.gearPlanWaterfallTitle} cells={cells} />
    </Panel>
  );
}
