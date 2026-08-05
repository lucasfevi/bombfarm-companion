'use client';

import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { ReoptResult } from '@bombfarm/domain/points-reopt';
import type { Strings } from '@/shared/i18n';
import { Button } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { cn } from '@bombfarm/ui';
import { usePlannerStore, selectHeroBattleAllowed } from '@/shared/stores';
import { optimizeResultDisplay } from '../model/points-preview-copy';

export type PointsPreview = { pts: Record<SheetKey, number>; result: ReoptResult };

export type OptimizeAvailability = { disabled: boolean; disabledReason: string | null };

/**
 * `DEC-10` — the Optimize build / Apply preview / Clear preview controls, the Tier 2 result
 * line (best-found / kept-current / budget-exhausted, `AC-13`), and the always-mounted respec
 * note (`DEC-03`). Component-local preview state (`DEC-02`) lives in the shell
 * (`points-table.tsx`); this is a controlled renderer over it. Apply/Clear stay MOUNTED and
 * `disabled` rather than hidden — the `Button` primitive already dresses `disabled` (no CLS
 * either way); the result line and respec note have no other sensible "off" state, so they
 * toggle `invisible` + `aria-hidden` instead.
 */
export function PointsPreviewActions({
  t,
  preview,
  justApplied,
  optimize,
  formatNumber,
  onOptimize,
  onApply,
  onClear,
}: {
  t: Strings;
  preview: PointsPreview | null;
  justApplied: boolean;
  optimize: OptimizeAvailability;
  formatNumber: (n: number, d?: number) => string;
  onOptimize: () => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const heroEnabled = usePlannerStore(selectHeroBattleAllowed);
  const resultDisplay = preview ? optimizeResultDisplay(t, preview.result, formatNumber) : null;
  const showBudgetExhausted = !!preview?.result.budgetExhausted;
  const showDisabledNote = !heroEnabled;

  return (
    <div className="mt-2.5 flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="primary"
          onClick={onOptimize}
          disabled={optimize.disabled}
          title={optimize.disabled ? (optimize.disabledReason ?? undefined) : undefined}
        >
          {t.optimizeBuildButton}
        </Button>
        <Button type="button" onClick={onApply} disabled={!preview}>
          {t.previewApplyButton}
        </Button>
        <Button type="button" variant="ghost" onClick={onClear} disabled={!preview}>
          {t.previewClearButton}
        </Button>
      </div>
      <p
        className={cn(mutedClass, 'm-0 max-w-prose text-right', !showDisabledNote && 'invisible')}
        aria-hidden={!showDisabledNote}
      >
        {t.optimizeBuildHeroDisabledNote}
      </p>
      <p
        className={cn(mutedClass, 'm-0 text-right', !preview && 'invisible')}
        aria-hidden={!preview}
      >
        {resultDisplay?.kind === 'kept'
          ? resultDisplay.text
          : resultDisplay?.kind === 'delta'
            ? resultDisplay.node
            : ' '}
      </p>
      <p
        className={cn(mutedClass, 'm-0 text-right', !showBudgetExhausted && 'invisible')}
        aria-hidden={!showBudgetExhausted}
      >
        {t.optimizeBuildBudgetExhausted}
      </p>
      <p
        className={cn(mutedClass, 'm-0 text-right', !justApplied && 'invisible')}
        aria-hidden={!justApplied}
      >
        {t.previewRespecNote}
      </p>
    </div>
  );
}
