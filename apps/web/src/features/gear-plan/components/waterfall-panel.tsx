'use client';

import type { ReactNode } from 'react';
import type { GearPlan as DomainGearPlan, WaterfallStep } from '@bombfarm/domain/gear-plan/types';
import { Panel, Tooltip, cn } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { formatCompactNumber, formatNumber } from '@/shared/lib/format-number';
import { AbbreviatedNumber } from './abbreviated-number';
import { StepCell } from './step-cell';

const stepLabels: Record<WaterfallStep['id'], (strings: Strings) => string> = {
  today: (strings) => strings.gearPlanStepToday,
  gear: (strings) => strings.gearPlanStepGear,
  respec: (strings) => strings.gearPlanStepRespec,
};

function withDeltaPlaceholder(template: string, delta: ReactNode) {
  const [before = '', after = ''] = template.split('{delta}');
  return (
    <>
      {before}
      {delta}
      {after}
    </>
  );
}

export function WaterfallPanel({ t, plan }: { t: Strings; plan: DomainGearPlan }) {
  const totalDelta = plan.planDps - plan.currentDps;
  const totalPct = plan.currentDps > 0 ? (totalDelta / plan.currentDps) * 100 : 0;
  const totalSign = totalDelta >= 0 ? '+' : '';
  const pctSign = totalPct >= 0 ? '+' : '';

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanWaterfallTitle}</h2>
        <p className="m-0 text-[12px] font-normal text-muted">{t.gearPlanResultsHeader}</p>
      </div>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <div
          className="mt-1 grid gap-px overflow-hidden rounded-sm border border-line bg-line"
          role="group"
          aria-label={t.gearPlanWaterfallTitle}
        >
          <div className="flex flex-col items-center justify-center bg-[color-mix(in_oklch,var(--accent)_8%,var(--surface))] px-4 py-5 text-center sm:px-5 sm:py-6">
            <p className="m-0 text-[11px] font-bold tracking-[0.08em] text-muted uppercase">
              {t.gearPlanTotalGainLabel}
            </p>
            <Tooltip.Root>
              <Tooltip.Trigger
                render={
                  <p
                    className={cn(
                      'm-0 mt-2 text-[clamp(1.75rem,4vw,2.35rem)] leading-none font-black tracking-tight tabular-nums',
                      totalDelta < 0 ? 'text-down' : 'text-up',
                    )}
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
          </div>

          <div className="grid grid-cols-1 gap-px sm:grid-cols-3">
            {plan.steps.map((step) => {
              const showDelta = step.id !== 'today' && step.delta !== 0;
              return (
                <StepCell
                  key={step.id}
                  label={stepLabels[step.id](t)}
                  value={<AbbreviatedNumber value={step.objective} />}
                  delta={showDelta ? <AbbreviatedNumber value={step.delta} signed /> : null}
                  deltaTone={step.delta < 0 ? 'down' : 'up'}
                />
              );
            })}
          </div>
        </div>
      </Tooltip.Provider>
      {plan.requiresFullPlan ? (
        <p className="m-0 mt-2 text-center text-[12px] text-muted" role="status">
          {withDeltaPlaceholder(
            t.gearPlanGearDipNote,
            <AbbreviatedNumber value={plan.gearDipDps} />,
          )}
        </p>
      ) : null}
    </Panel>
  );
}
