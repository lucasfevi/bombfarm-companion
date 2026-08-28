'use client';

import type { SheetKey } from '@bombfarm/domain/planner-constants';
import type { ReoptResult } from '@bombfarm/domain/points-reopt';
import type { Strings } from '@/shared/i18n';
import { Button } from '@bombfarm/ui';
import { usePlannerStore, selectHeroBattleAllowed } from '@/shared/stores';
import { optimizeResultDisplay } from '../model/points-preview-copy';
import { PointsPreviewNotice } from './points-preview-notice';

export type PointsPreview = { pts: Record<SheetKey, number>; result: ReoptResult };

export type OptimizeAvailability = { disabled: boolean; disabledReason: string | null };

/**
 * Optimize / Apply / Clear plus typed preview notices.
 * Preview state lives in `points-table.tsx`. Apply/Clear stay mounted and
 * `disabled`. Notices are a left-aligned rail under the actions — each line animates
 * through `PointsPreviewNotice` instead of an always-reserved invisible slot.
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
    <div className="mt-2.5 flex flex-col gap-1.5">
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
      <div className="flex w-full min-w-0 flex-col">
        <PointsPreviewNotice open={showDisabledNote} tone="warn">
          {t.optimizeBuildHeroDisabledNote}
        </PointsPreviewNotice>
        <PointsPreviewNotice open={!!resultDisplay} tone={resultDisplay?.kind === 'delta' ? 'up' : 'muted'}>
          {resultDisplay?.kind === 'kept'
            ? resultDisplay.text
            : resultDisplay?.kind === 'delta'
              ? resultDisplay.node
              : null}
        </PointsPreviewNotice>
        <PointsPreviewNotice open={showBudgetExhausted} tone="warn">
          {t.optimizeBuildBudgetExhausted}
        </PointsPreviewNotice>
        <PointsPreviewNotice open={justApplied} tone="muted">
          {t.previewRespecNote}
        </PointsPreviewNotice>
      </div>
    </div>
  );
}
