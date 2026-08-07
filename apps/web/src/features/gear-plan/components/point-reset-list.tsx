'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { Collapsible, Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { usePlannerStore, selectHeroes } from '@/shared/stores';
import { shortHeroRecordId } from '@/features/gear-plan/model/build-gear-plan-input';

export function PointResetList({ t, plan }: { t: Strings; plan: GearPlan }) {
  const heroes = usePlannerStore(selectHeroes);
  const empty = plan.pointResets.length === 0;

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
            <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
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
                return (
                  <li key={resetRow.heroId}>
                    {sub(t.gearPlanPointResetRow, {
                      hero: heroLabel,
                      gain: String(Math.round(resetRow.gainPct)),
                    })}
                  </li>
                );
              })}
            </ul>
          )}
        </Collapsible.Panel>
      </Collapsible.Root>
    </Panel>
  );
}
