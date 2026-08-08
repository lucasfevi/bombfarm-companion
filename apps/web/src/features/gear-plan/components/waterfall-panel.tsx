'use client';

import type { GearPlan as DomainGearPlan, WaterfallStep } from '@bombfarm/domain/gear-plan/types';
import { MetricScoreboard, Panel, Tooltip, type MetricScoreboardCell } from '@bombfarm/ui';
import { mutedClass, panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { formatCompactNumber, formatNumber } from '@/shared/lib/format-number';
import { AbbreviatedNumber } from './abbreviated-number';

const stepLabels: Record<WaterfallStep['id'], (strings: Strings) => string> = {
  today: (strings) => strings.gearPlanStepToday,
  gear: (strings) => strings.gearPlanStepGear,
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
      value: <AbbreviatedNumber value={step.objective} />,
      delta: showDelta ? <AbbreviatedNumber value={step.delta} signed /> : null,
      deltaTone: step.delta < 0 ? 'down' : 'up',
    };
  });

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanWaterfallTitle}</h2>
        <p className="m-0 text-[12px] font-normal text-muted">{t.gearPlanResultsHeader}</p>
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <p className={`m-0 mb-2 ${mutedClass}`}>{t.gearPlanCompactNumberHint}</p>
        <div className="mb-3 border-b border-line pb-3">
          <p className="m-0 text-[11px] tracking-wide text-muted uppercase">{t.gearPlanTotalGainLabel}</p>
          <Tooltip.Root>
            <Tooltip.Trigger
              render={
                <p
                  className={`m-0 mt-1 text-2xl leading-tight font-black tracking-tight tabular-nums ${totalDelta < 0 ? 'text-down' : 'text-up'}`}
                />
              }
            >
              {sub(t.gearPlanTotalGainValue, {
                delta: `${totalSign}${formatCompactNumber(totalDelta, 1)}`,
                pct: `${pctSign}${formatNumber(totalPct, 1)}`,
              })}
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0 font-mono">
                    {sub(t.gearPlanTotalGainValue, {
                      delta: `${totalSign}${formatNumber(totalDelta, 0)}`,
                      pct: `${pctSign}${formatNumber(totalPct, 1)}`,
                    })}
                  </p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <p className="m-0 mt-1 text-[12px] text-muted">
            {t.gearPlanCurrentDps}: <AbbreviatedNumber value={plan.currentDps} />
            {' → '}
            {t.gearPlanPlanDps}: <AbbreviatedNumber value={plan.planDps} />
          </p>
        </div>
        <MetricScoreboard
          aria-label={t.gearPlanWaterfallTitle}
          cells={cells}
          className="sm:grid-cols-3 lg:grid-cols-3"
        />
      </Tooltip.Provider>
      {plan.requiresFullPlan ? (
        <p className="m-0 mt-2 text-[12px] text-muted" role="status">
          {sub(t.gearPlanGearDipNote, { delta: formatNumber(plan.gearDipDps, 0) })}
        </p>
      ) : null}
    </Panel>
  );
}
