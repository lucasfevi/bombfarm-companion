'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';

function signed(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatNumber(value, 0)}`;
}

export function PlanDisclosures({
  t,
  plan,
  requestedForgeFloor,
}: {
  t: Strings;
  plan: GearPlan;
  requestedForgeFloor: number;
}) {
  const unmodelled = plan.disclosures.unmodelledAbilities
    .map((row) => `${row.abilityId} (${row.heroNames.join(', ')})`)
    .join('; ');
  const forgeSkipped = requestedForgeFloor > 0 && plan.forgeFloorApplied === 0;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanDisclosuresTitle}</h2>
      </div>
      <div className="space-y-3 text-[13px] text-muted">
        {plan.regime === 'saturated' ? (
          <p className="m-0 rounded-sm border border-warn/40 bg-[color-mix(in_oklch,var(--warn)_8%,transparent)] px-3 py-2 text-ink">
            {sub(t.gearPlanSaturationCallout, {
              duty: String(plan.sumDuty.toFixed(2)),
              slots: String(plan.slots),
            })}
          </p>
        ) : null}
        <p className="m-0">{t.gearPlanAuraDisclosure}</p>
        <p className="m-0">{t.gearPlanPlannerDivergence}</p>
        {unmodelled ? (
          <p className="m-0">{sub(t.gearPlanUnmodelledAbilities, { list: unmodelled })}</p>
        ) : null}
        {plan.disclosures.loadoutDriftHeroNames.length > 0 ? (
          <p className="m-0">
            {sub(t.gearPlanLoadoutDrift, {
              heroes: plan.disclosures.loadoutDriftHeroNames.join(', '),
            })}
          </p>
        ) : null}
        <p className="m-0">
          {sub(t.gearPlanExcludedItems, {
            market: String(plan.disclosures.marketBlockedItemCount),
            unresolved: '0',
            foreign: String(plan.disclosures.foreignOwnedItemCount),
          })}
        </p>
        {forgeSkipped ? <p className="m-0">{t.gearPlanForgeSkippedNote}</p> : null}
        {plan.gearBreakdown.forgeDelta !== 0 ? (
          <p className="m-0">
            {sub(t.gearPlanGearBreakdownForge, { delta: signed(plan.gearBreakdown.forgeDelta) })}
          </p>
        ) : null}
        {plan.gearBreakdown.moveDelta !== 0 ? (
          <p className="m-0">
            {sub(t.gearPlanGearBreakdownMoves, { delta: signed(plan.gearBreakdown.moveDelta) })}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
