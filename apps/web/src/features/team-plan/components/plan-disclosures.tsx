'use client';

import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { mayMoveGear, mayRespendPoints } from '@bombfarm/domain/team-plan';
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
  // Read off the PLAN, not the live control: a plan outlives the setting that produced it, and
  // these two lines are the difference between "forging did not pay" and "forging was never on
  // the table" — only the plan knows which of those its empty forge list means.
  const gearAllowed = mayMoveGear(plan.allowedChanges);
  const forgeSkipped = gearAllowed && requestedForgeFloor > 0 && plan.forgeFloorApplied === 0;

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
        {gearAllowed ? (
          <p className="m-0">
            {sub(t.teamPlanExcludedItems, {
              market: String(plan.disclosures.marketBlockedItemCount),
              unresolved: String(plan.disclosures.unresolvedDefItemCount),
              foreign: String(plan.disclosures.foreignOwnedItemCount),
            })}
          </p>
        ) : null}
        {forgeSkipped ? <p className="m-0">{copy.forgeSkippedNote}</p> : null}
        {!gearAllowed ? <p className="m-0">{t.teamPlanAllowedChangesNotePoints}</p> : null}
        {!mayRespendPoints(plan.allowedChanges) ? (
          <p className="m-0">{t.teamPlanAllowedChangesNoteGear}</p>
        ) : null}
      </div>
    </Panel>
  );
}
