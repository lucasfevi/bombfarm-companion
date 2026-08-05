'use client';

import { useState } from 'react';
import { SHEET_PANEL_KEYS, ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { budgetOf, optimizeBuild } from '@bombfarm/domain/points-reopt';
import { sub } from '@/shared/i18n';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import { usePlannerStore, selectAdvisorPipeline } from '@/shared/stores';
import { Button, DataTable, Panel } from '@bombfarm/ui';
import {
  mutedClass,
  panelHClass,
  panelTitleClass,
  warnClass,
} from '@bombfarm/ui/panel-field.recipe';
import { PointsStatRow } from './points-stat-row';
import { PointsPreviewActions, type PointsPreview } from './points-preview-actions';
import { PointsResetAdvice } from './points-reset-advice';
import { hasApplicableGain } from '../model/points-preview-copy';

/**
 * Points panel shell (`DEC-10` split): header (title, spent/level counter, Reset), the stat
 * table (rows via `PointsStatRow`, `SHEET_PANEL_KEYS` — 8, incl. Luck, `DEC-06`/`AC-19`), and
 * the preview / Optimize build controls (`PointsPreviewActions`).
 *
 * Preview `{ pts, result }` is `useState` here (`DEC-02`) — never a store field, never
 * `localStorage`. It is cleared by the SAME handler every `pts` mutation goes through
 * (`handlePtsMutate`) and, per-hero, by keying this whole component on `activeHeroId` at its
 * call site (`AdviceColumn`) — a remount, not an effect (design.md: "a useEffect-free
 * consequence of keying"; an effect keyed on `pts` would also fire on Apply and discard the
 * vector it just committed).
 */
export function PointsTable() {
  const { t } = useAppLang();
  const level = usePlannerStore((state) => state.level);
  const pts = usePlannerStore((state) => state.pts);
  const setPts = usePlannerStore((state) => state.setPts);
  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const { spentDelta, pointDelta, adjusted, resetAdvice } = pipeline;

  const [preview, setPreview] = useState<PointsPreview | null>(null);
  const [justApplied, setJustApplied] = useState(false);

  function handlePtsMutate(next: Record<SheetKey, number>) {
    setPreview(null);
    setJustApplied(false);
    setPts(next);
  }

  function handleOptimize() {
    // ASM-02: on demand, in the click handler only — never render, a selector, or an effect.
    const result = optimizeBuild({
      pts,
      effective: pipeline.effective,
      effectiveDelta: pipeline.A.effectiveDelta,
      context: pipeline.context,
    });
    setPreview({ pts: result.pts, result });
  }

  function handleApply() {
    if (!preview) return;
    // Spec edge case: a search with no measurable gain is a no-op, not a rewrite of an
    // equally-scoring reshuffle — and no respec note for zero player benefit.
    if (hasApplicableGain(preview.result)) {
      // AD-BSP-21: preview.pts already echoes pts.luck untouched — no special-casing needed.
      setPts(preview.pts);
      setJustApplied(true);
    }
    setPreview(null);
  }

  function handleClear() {
    setPreview(null);
  }

  const budget = budgetOf(pts);
  const previewValueFor = (key: SheetKey): number | null => {
    if (!preview) return null;
    // Same shared-pool shape as `adjusted[key] = gearedX[key] + pts[key] × delta[key]`
    // (`derive.ts`), reused as a per-point-rate step from the current pts to the preview's —
    // stays in the "After" column's own basis, not `effective`'s combat-multiplied one.
    return adjusted[key] + (preview.pts[key] - pts[key]) * pointDelta[key];
  };

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.panelPoints}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className={spentDelta > level ? warnClass : mutedClass}>
            {sub(t.abilitiesSpent, { spent: spentDelta, max: level })}
          </span>
          <Button type="button" onClick={() => handlePtsMutate(ZERO_PTS())}>
            {t.reset}
          </Button>
        </div>
      </div>
      <PointsResetAdvice t={t} resetAdvice={resetAdvice} formatNumber={formatNumber} />
      <DataTable.Root>
        <DataTable.Table className="table-fixed">
          <colgroup>
            <col />
            <col className="w-42" />
            {/* content-fit-ui.md: widened for the 2 dp precision sweep (BSP-29). */}
            <col className="w-16" />
            <col className="w-24" />
            <col className="w-24" />
          </colgroup>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header>{t.colStat}</DataTable.Header>
              <DataTable.Header align="center">Δ</DataTable.Header>
              <DataTable.Header align="right">{t.colPerPt}</DataTable.Header>
              <DataTable.Header align="right">{t.colAfter}</DataTable.Header>
              <DataTable.Header align="right">{t.colPreview}</DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {SHEET_PANEL_KEYS.map((key) => (
              <PointsStatRow
                key={key}
                t={t}
                statKey={key}
                pts={pts}
                level={level}
                values={{
                  perPt: pointDelta[key],
                  after: adjusted[key],
                  preview: previewValueFor(key),
                }}
                onPts={handlePtsMutate}
                formatNumber={formatNumber}
              />
            ))}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
      <PointsPreviewActions
        t={t}
        preview={preview}
        justApplied={justApplied}
        optimize={{ disabled: budget <= 0, disabledReason: budget <= 0 ? t.optimizeBuildNoBudgetReason : null }}
        formatNumber={formatNumber}
        onOptimize={handleOptimize}
        onApply={handleApply}
        onClear={handleClear}
      />
    </Panel>
  );
}
