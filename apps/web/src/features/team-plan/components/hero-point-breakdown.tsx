'use client';

import { SHEET_PANEL_KEYS } from '@bombfarm/domain/planner-constants';
import type { PointAlloc } from '@bombfarm/domain/gear';
import { DeltaTable, type DeltaTableRow } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';

export function HeroPointBreakdown({
  t,
  pointsBefore,
  pointsAfter,
}: {
  t: Strings;
  pointsBefore: PointAlloc;
  pointsAfter: PointAlloc;
}) {
  const rows: DeltaTableRow[] = SHEET_PANEL_KEYS.map((key) => ({
    id: key,
    label: t.statShort[key],
    now: pointsBefore[key],
    target: pointsAfter[key],
  }));
  if (rows.every((row) => row.now === 0 && row.target === 0)) return null;
  return (
    <DeltaTable
      caption={t.teamPlanHeroBreakdownPointsTitle}
      columnLabels={{
        label: t.colStat,
        now: t.teamPlanColBefore,
        target: t.teamPlanColAfter,
        change: t.teamPlanColDelta,
      }}
      rows={rows}
      decimals={0}
      hideZeroRows
    />
  );
}
