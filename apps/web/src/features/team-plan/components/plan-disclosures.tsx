'use client';

import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import { abilityName } from '@bombfarm/domain/game-labels';
import { Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { formatCompactNumber } from '@/shared/lib/format-number';

/** Enough names to recognise the problem, short enough to stay one readable line. */
export const CONTENTION_NAMES_SHOWN = 4;

/**
 * Exported for unit test: a contested field can put most of the roster under the break-even
 * (eleven of fifteen heroes on the save that prompted this), and a banner listing all of them
 * stops being readable.
 */
export function contentionHeroList(names: string[], overflowTemplate: string): string {
  const shown = names.slice(0, CONTENTION_NAMES_SHOWN).join(', ');
  const hidden = names.length - CONTENTION_NAMES_SHOWN;
  return hidden > 0 ? sub(overflowTemplate, { heroes: shown, count: hidden }) : shown;
}

export function PlanDisclosures({
  t,
  lang,
  plan,
  requestedForgeFloor,
}: {
  t: Strings;
  lang: Lang;
  plan: TeamPlan;
  requestedForgeFloor: number;
}) {
  const unmodelled = plan.disclosures.unmodelledAbilities
    .map((row) => `${abilityName(row.abilityId, lang)} (${row.heroNames.join(', ')})`)
    .join('; ');
  const forgeSkipped = requestedForgeFloor > 0 && plan.forgeFloorApplied === 0;
  const contention = plan.disclosures.fieldContention;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.teamPlanDisclosuresTitle}</h2>
      </div>
      <div className="space-y-3 text-[13px] text-muted">
        {contention ? (
          <div
            className="m-0 space-y-2 rounded-sm border border-warn/40 bg-[color-mix(in_oklch,var(--warn)_8%,transparent)] px-3 py-2 text-ink"
            role="status"
          >
            <p className="m-0">
              {sub(t.teamPlanSaturationCallout, {
                duty: String(contention.sumDuty.toFixed(2)),
                slots: String(contention.slots),
              })}
            </p>
            <p className="m-0">
              {sub(t.teamPlanContentionDilution, {
                mean: formatCompactNumber(contention.meanActiveDps, 1),
              })}
            </p>
            {contention.dilutingHeroNames.length > 0 ? (
              <p className="m-0">
                {sub(t.teamPlanContentionHeroes, {
                  heroes: contentionHeroList(
                    contention.dilutingHeroNames,
                    t.teamPlanContentionHeroesOverflow,
                  ),
                })}
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="m-0">{t.teamPlanAuraDisclosure}</p>
        <p className="m-0">
          {sub(t.teamPlanPlannerDivergence, {
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
        {forgeSkipped ? <p className="m-0">{t.teamPlanForgeSkippedNote}</p> : null}
      </div>
    </Panel>
  );
}
