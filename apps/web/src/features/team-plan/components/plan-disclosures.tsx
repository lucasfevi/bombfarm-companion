'use client';

import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { abilityName } from '@bombfarm/domain/game-labels';
import { Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import type { TeamPlanObjectiveCopy } from '@/features/team-plan/model/objective-copy';

export function PlanDisclosures({
  t,
  lang,
  plan,
  requestedForgeFloor,
  copy,
}: {
  t: Strings;
  lang: Lang;
  plan: TeamPlan;
  requestedForgeFloor: number;
  copy: TeamPlanObjectiveCopy;
}) {
  const unmodelled = plan.disclosures.unmodelledAbilities
    .map((row) => `${abilityName(row.abilityId, lang)} (${row.heroNames.join(', ')})`)
    .join('; ');
  const forgeSkipped = requestedForgeFloor > 0 && plan.forgeFloorApplied === 0;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.teamPlanDisclosuresTitle}</h2>
      </div>
      <div className="space-y-3 text-[13px] text-muted">
        {plan.regime === 'saturated' ? (
          <p className="m-0 rounded-sm border border-warn/40 bg-[color-mix(in_oklch,var(--warn)_8%,transparent)] px-3 py-2 text-ink">
            {sub(copy.saturationCallout, {
              duty: String(plan.sumDuty.toFixed(2)),
              slots: String(plan.slots),
            })}
          </p>
        ) : null}
        <p className="m-0">{copy.auraDisclosure}</p>
        <p className="m-0">
          {sub(copy.plannerDivergence, {
            ability: abilityName('passagem_bastao', lang),
          })}
        </p>
        {unmodelled ? (
          <p className="m-0">{sub(t.teamPlanUnmodelledAbilities, { list: unmodelled })}</p>
        ) : null}
        {plan.disclosures.loadoutDriftHeroNames.length > 0 ? (
          <p className="m-0">
            {sub(t.teamPlanLoadoutDrift, {
              heroes: plan.disclosures.loadoutDriftHeroNames.join(', '),
            })}
          </p>
        ) : null}
        <p className="m-0">
          {sub(t.teamPlanExcludedItems, {
            market: String(plan.disclosures.marketBlockedItemCount),
            unresolved: String(plan.disclosures.unresolvedDefItemCount),
            foreign: String(plan.disclosures.foreignOwnedItemCount),
          })}
        </p>
        {forgeSkipped ? <p className="m-0">{copy.forgeSkippedNote}</p> : null}
      </div>
    </Panel>
  );
}
