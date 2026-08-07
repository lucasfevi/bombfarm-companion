'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { DataTable, Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';

export function ForgeList({ t, plan }: { t: Strings; plan: GearPlan }) {
  const empty = plan.forgeList.length === 0;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanForgeListTitle}</h2>
      </div>
      {empty ? (
        <p className="m-0 text-sm text-muted">{t.gearPlanForgeListEmpty}</p>
      ) : (
        <DataTable.Root className="rounded-sm border border-line">
          <DataTable.Table>
            <DataTable.Body>
              {plan.forgeList.map((row) => (
                <DataTable.Row key={row.itemId}>
                  <DataTable.Cell>
                    {sub(t.gearPlanForgeListRow, {
                      defId: row.defId,
                      from: String(row.from),
                      to: String(row.to),
                    })}
                  </DataTable.Cell>
                </DataTable.Row>
              ))}
            </DataTable.Body>
          </DataTable.Table>
        </DataTable.Root>
      )}
    </Panel>
  );
}
