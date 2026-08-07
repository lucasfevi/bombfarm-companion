'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { DataTable, Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';
import { usePlannerStore, selectHeroes } from '@/shared/stores';
import { shortHeroRecordId } from '@/features/gear-plan/model/build-gear-plan-input';

export function HeroDeltaTable({ t, plan }: { t: Strings; plan: GearPlan }) {
  const heroes = usePlannerStore(selectHeroes);
  const heroByScopeKey = new Map(heroes.map((hero) => [hero.sourceId ?? hero.id, hero]));

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanHeroDeltaTitle}</h2>
      </div>
      <DataTable.Root scrollable maxRows={12} className="rounded-sm border border-line">
        <DataTable.Table>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header>{t.importColName}</DataTable.Header>
              <DataTable.Header align="right">{t.gearPlanColBefore}</DataTable.Header>
              <DataTable.Header align="right">{t.gearPlanColAfter}</DataTable.Header>
              <DataTable.Header align="right">{t.gearPlanColDelta}</DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {plan.perHero.map((row) => {
              const hero = heroByScopeKey.get(row.heroId);
              const label = hero
                ? sub(t.gearPlanHeroRowLabel, {
                    name: row.heroName,
                    level: String(row.level),
                    id: shortHeroRecordId(hero),
                  })
                : row.heroName;
              return (
                <DataTable.Row key={row.heroId}>
                  <DataTable.Cell>{label}</DataTable.Cell>
                  <DataTable.Cell align="right" numeric>
                    {formatNumber(row.before, 0)}
                  </DataTable.Cell>
                  <DataTable.Cell align="right" numeric>
                    {formatNumber(row.after, 0)}
                  </DataTable.Cell>
                  <DataTable.Cell
                    align="right"
                    numeric
                    className={row.delta < 0 ? 'text-down' : row.delta > 0 ? 'text-up' : undefined}
                  >
                    {row.delta >= 0 ? '+' : ''}
                    {formatNumber(row.delta, 0)}
                  </DataTable.Cell>
                </DataTable.Row>
              );
            })}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </Panel>
  );
}
