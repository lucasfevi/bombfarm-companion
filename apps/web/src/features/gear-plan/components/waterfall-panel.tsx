'use client';

import type { GearPlan as DomainGearPlan, WaterfallStep } from '@bombfarm/domain/gear-plan/types';
import { MetricScoreboard, Panel, type MetricScoreboardCell } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';

const stepLabels: Record<WaterfallStep['id'], (strings: Strings) => string> = {
  today: (strings) => strings.gearPlanStepToday,
  forged: (strings) => strings.gearPlanStepForged,
  moved: (strings) => strings.gearPlanStepMoved,
  respec: (strings) => strings.gearPlanStepRespec,
};

export function WaterfallPanel({ t, plan }: { t: Strings; plan: DomainGearPlan }) {
  const cells: MetricScoreboardCell[] = plan.steps.map((step) => ({
    id: step.id,
    label: stepLabels[step.id](t),
    value: formatNumber(step.objective, 0),
    delta: `${step.delta >= 0 ? '+' : ''}${formatNumber(step.delta, 0)}`,
    deltaTone: step.delta < 0 ? 'down' : 'up',
  }));

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanWaterfallTitle}</h2>
        <p className="m-0 text-[12px] font-normal text-muted">{t.gearPlanResultsHeader}</p>
      </div>
      <MetricScoreboard aria-label={t.gearPlanWaterfallTitle} cells={cells} />
    </Panel>
  );
}
