'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { Collapsible, Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { usePlannerStore, selectHeroes } from '@/shared/stores';
import { shortHeroRecordId } from '@/features/gear-plan/model/build-gear-plan-input';
import { formatNumber } from '@/shared/lib/format-number';

export function PointResetList({ t, plan }: { t: Strings; plan: GearPlan }) {
  const heroes = usePlannerStore(selectHeroes);
  const empty = plan.pointResets.length === 0;
  // Display-only: the total price tag for the listed resets. Never gates or filters anything —
  // we always show the price, we never refuse a reset for being expensive.
  const totalCostGold = plan.pointResets.reduce((sum, row) => sum + row.resetCostGold, 0);

  return (
    <Panel>
      <Collapsible.Root>
        <Collapsible.Trigger className="w-full text-left">
          <div className={panelHClass}>
            <h2 className={panelTitleClass}>{t.gearPlanPointResetTitle}</h2>
          </div>
        </Collapsible.Trigger>
        <Collapsible.Panel>
          {empty ? (
            <p className="m-0 text-sm text-muted">{t.gearPlanPointResetEmpty}</p>
          ) : (
            <>
              <ul className="m-0 list-disc space-y-2 pl-5 text-sm">
                {plan.pointResets.map((resetRow) => {
                  const hero = heroes.find(
                    (record) => (record.sourceId ?? record.id) === resetRow.heroId,
                  );
                  const heroLabel = hero
                    ? sub(t.gearPlanHeroRowLabel, {
                        name: hero.name,
                        level: String(hero.level),
                        id: shortHeroRecordId(hero),
                      })
                    : resetRow.heroId;
                  // A listed reset can carry a negative gainPct: the roster gains even when this
                  // hero personally loses sustained DPS. Show an explicit sign either way — do
                  // not imply every listed reset is a personal gain for the hero shown.
                  const rounded = Math.round(resetRow.gainPct);
                  const signedGain = rounded > 0 ? `+${rounded}` : String(rounded);
                  return (
                    <li key={resetRow.heroId}>
                      <p className="m-0">
                        {sub(t.gearPlanPointResetRow, {
                          hero: heroLabel,
                          gain: signedGain,
                        })}
                      </p>
                      <p className="m-0 text-[12px] text-muted">
                        {sub(t.gearPlanPointResetValueCost, {
                          dps: formatNumber(resetRow.rosterGainDps, 0),
                          gold: formatNumber(resetRow.resetCostGold, 0),
                        })}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <p className="m-0 mt-2 border-t border-line pt-2 text-[12px] text-muted">
                {sub(t.gearPlanPointResetTotalCost, { gold: formatNumber(totalCostGold, 0) })}
              </p>
            </>
          )}
        </Collapsible.Panel>
      </Collapsible.Root>
    </Panel>
  );
}
