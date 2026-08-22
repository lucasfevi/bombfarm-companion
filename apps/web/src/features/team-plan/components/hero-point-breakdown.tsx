'use client';

import { SHEET_PANEL_KEYS } from '@bombfarm/domain/planner-constants';
import { pointsExceedLevel, spentPointsOf } from '@bombfarm/domain/point-inference';
import type { PointAlloc } from '@bombfarm/domain/gear';
import { DeltaTable, type DeltaTableRow } from '@bombfarm/ui';
import { sub, type Strings } from '@/shared/i18n';

export function HeroPointBreakdown({
  t,
  pointsBefore,
  pointsAfter,
  level,
}: {
  t: Strings;
  pointsBefore: PointAlloc;
  pointsAfter: PointAlloc;
  /** The hero's own level — the ceiling the BEFORE column is checked against. */
  level: number;
}) {
  const rows: DeltaTableRow[] = SHEET_PANEL_KEYS.map((key) => ({
    id: key,
    label: t.statShort[key],
    now: pointsBefore[key],
    target: pointsAfter[key],
  }));
  if (rows.every((row) => row.now === 0 && row.target === 0)) return null;
  // BEFORE is the hero's own inferred allocation and is not clamped; AFTER comes from a search
  // that is (`resetBudget` / `reoptBudget`). So an over-budget hero renders a reset that appears
  // to lose a point, with the two columns disagreeing about how many the hero even has. Say so,
  // rather than letting the table imply the difference is something the plan did.
  const overBudget = pointsExceedLevel(pointsBefore, level);
  return (
    <>
      {overBudget && (
        <p role="alert" className="m-0 mb-2 max-w-prose border-l-2 border-warn py-1 pl-2.5 text-xs leading-snug text-warn">
          {sub(t.pointsOverBudgetWarning, { spent: spentPointsOf(pointsBefore), level })}
        </p>
      )}
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
    </>
  );
}
