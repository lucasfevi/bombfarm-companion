'use client';

import type { RankMode } from '@bombfarm/domain/model';
import type { Strings } from '@/shared/i18n';
import { Button, Select } from '@bombfarm/ui';
import {
  optimizeGroupClass,
  optimizeGroupButtonClass,
  optimizeGroupSelectClass,
} from '@bombfarm/ui/panel-field.recipe';
import { usePlannerStore, selectHeroBattleAllowed } from '@/shared/stores';
import { farmOptimizeNotice, previewResultDisplay, type PointsPreview } from '../model/points-preview-copy';
import { PointsPreviewNotice } from './points-preview-notice';

export type { PointsPreview } from '../model/points-preview-copy';

/** The Optimize control as one unit: whether it can run, and what it runs against. */
export type OptimizeControl = {
  disabled: boolean;
  disabledReason: string | null;
  mode: RankMode;
  onModeChange: (next: RankMode) => void;
};

/**
 * Optimize / Apply / Clear plus typed preview notices.
 * Preview state lives in `points-table.tsx`. Apply/Clear stay mounted and
 * `disabled`. Notices are a left-aligned rail under the actions — each line animates
 * through `PointsPreviewNotice` instead of an always-reserved invisible slot.
 *
 * The target Select is drawn INTO the Optimize button rather than beside it: it changes what
 * that one button does and nothing else on the panel, and a detached control would read as a
 * panel-wide setting the way the Next point panel's own mode Select legitimately does.
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
  optimize: OptimizeControl;
  formatNumber: (n: number, d?: number) => string;
  onOptimize: () => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const heroEnabled = usePlannerStore(selectHeroBattleAllowed);
  const resultDisplay = preview ? previewResultDisplay(t, preview, formatNumber) : null;
  const farmNotice = preview?.mode === 'farm' ? farmOptimizeNotice(t, preview.result.outcome) : null;
  const showBudgetExhausted = !!preview?.result.budgetExhausted;
  const showDisabledNote = !heroEnabled;

  return (
    <div className="mt-2.5 flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <div className={optimizeGroupClass}>
          <Button
            type="button"
            variant="primary"
            className={optimizeGroupButtonClass}
            onClick={onOptimize}
            disabled={optimize.disabled}
            title={optimize.disabled ? (optimize.disabledReason ?? undefined) : undefined}
          >
            {t.optimizeBuildButton}
          </Button>
          <Select
            size="compact"
            className={optimizeGroupSelectClass}
            aria-label={t.optimizeModeLabel}
            value={optimize.mode}
            onChange={(event) => optimize.onModeChange(event.target.value as RankMode)}
          >
            <option value="dps">{t.modeDps}</option>
            <option value="farm">{t.modeFarm}</option>
          </Select>
        </div>
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
        <PointsPreviewNotice open={!!farmNotice} tone="warn">
          {farmNotice}
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
