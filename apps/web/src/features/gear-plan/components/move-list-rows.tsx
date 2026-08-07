'use client';

import type { GearPlan } from '@bombfarm/domain/gear-plan/types';
import { DataTable } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';

export function MoveListRows({
  t,
  rows,
  heroName,
  kind,
}: {
  t: Strings;
  rows: GearPlan['moveList'];
  heroName: (id: string | null) => string;
  kind: 'unequip' | 'equip';
}) {
  return (
    <DataTable.Root className="rounded-sm border border-line">
      <DataTable.Table>
        <DataTable.Body>
          {rows.map((row) => (
            <DataTable.Row key={`${row.phase}-${row.itemId}`} data-move-phase={row.phase}>
              <DataTable.Cell>
                {kind === 'unequip'
                  ? sub(t.gearPlanMoveRowUnequip, { defId: row.defId, hero: heroName(row.fromHeroId) })
                  : sub(t.gearPlanMoveRowEquip, {
                      defId: row.defId,
                      hero: heroName(row.toHeroId),
                      slot: row.slot,
                    })}
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
