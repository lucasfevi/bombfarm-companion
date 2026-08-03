'use client';

import { clampPointStep, type SheetKey } from '@bombfarm/domain/planner-constants';
import { sub, type Strings } from '@/shared/i18n';
import { Button, DataTable, Stepper } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { cn } from '@bombfarm/ui';

/** −5 / +5 buttons: the `Button` `default` variant, narrowed to a compact fixed-height pill
 *  (content-fit-ui.md — sized for "−5"/"+5", not the variant's default text-button padding). */
const fiveStepBtnClass = 'h-6 min-w-[1.75rem] px-1 py-0 text-[10px] leading-none';

/**
 * One Points stat row: label, −5 / −1 / value / +1 / +5, per-point gain, after value.
 * `DEC-10` split (component-per-file, `MOD-24`/`MOD-28`). Every step routes through
 * `clampPointStep` (`BSP-25`) — the user's Q-1 decision means ±1 shares the SAME clamp as ±5
 * (floor at 0, ceiling at `level`), not just the floor `DEC-05` proposed.
 */
/** The row's three numeric readouts, bundled to keep `PointsStatRow` at MOD-17's 8-prop cap. */
export type PointsStatRowValues = {
  perPt: number;
  after: number;
  /** `DEC-03` — the preview cell is always mounted; `null` means "no preview", not "preview is 0". */
  preview: number | null;
};

export function PointsStatRow({
  t,
  statKey,
  pts,
  level,
  values,
  onPts,
  formatNumber,
}: {
  t: Strings;
  statKey: SheetKey;
  pts: Record<SheetKey, number>;
  level: number;
  values: PointsStatRowValues;
  onPts: (next: Record<SheetKey, number>) => void;
  formatNumber: (n: number, d?: number) => string;
}) {
  const label = t.statFull[statKey];
  const step = (delta: number) => onPts(clampPointStep(pts, statKey, delta, level));
  const { perPt: perPtValue, after: afterValue, preview: previewValue } = values;

  return (
    <DataTable.Row>
      <DataTable.Cell className="truncate">{t.statShort[statKey]}</DataTable.Cell>
      <DataTable.Cell align="center" nowrap={false}>
        <div className="inline-flex items-center gap-1.5">
          <Button
            type="button"
            variant="default"
            className={fiveStepBtnClass}
            onClick={() => step(-5)}
            aria-label={sub(t.pointsStepMinusFiveAria, { stat: label })}
          >
            −5
          </Button>
          <Stepper
            value={pts[statKey]}
            onDecrement={() => step(-1)}
            onIncrement={() => step(1)}
          />
          <Button
            type="button"
            variant="default"
            className={fiveStepBtnClass}
            onClick={() => step(5)}
            aria-label={sub(t.pointsStepPlusFiveAria, { stat: label })}
          >
            +5
          </Button>
        </div>
      </DataTable.Cell>
      {/* BSP-29/AC-25: sheet magnitudes at 2 dp (Points Δ per point and after). */}
      <DataTable.Cell align="right" numeric className={mutedClass}>
        {formatNumber(perPtValue, 2)}
      </DataTable.Cell>
      <DataTable.Cell align="right" numeric>
        <b>{formatNumber(afterValue, 2)}</b>
      </DataTable.Cell>
      {/* DEC-03: always mounted, fixed <col> width — toggles invisible, never mount/unmount. */}
      <DataTable.Cell
        align="right"
        numeric
        className={cn('text-accent', previewValue === null && 'invisible')}
        aria-hidden={previewValue === null}
      >
        <b>{formatNumber(previewValue ?? afterValue, 2)}</b>
      </DataTable.Cell>
    </DataTable.Row>
  );
}
