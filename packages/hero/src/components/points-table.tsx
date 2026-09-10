'use client';

import { useState, useMemo } from 'react';
import type { AdvisorPipelineResult } from '@bombfarm/domain/advisor-pipeline';
import type { HeroFarmOptimizeResult } from '@bombfarm/domain/farm-hero-optimize';
import type { RankMode } from '@bombfarm/domain/model';
import { SHEET_PANEL_KEYS, ZERO_PTS, type SheetKey } from '@bombfarm/domain/planner-constants';
import { optimizeBuild, reoptBudget } from '@bombfarm/domain/points-reopt';
import { pointsExceedLevel } from '@bombfarm/domain/point-inference';
import {
  Button,
  DataTable,
  Panel,
  mutedClass,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  warnClass,
} from '@bombfarm/ui';
import { sub, type Lang, type StatPanelCopy } from '../copy';
import { PointsStatRow } from './points-stat-row';
import { PointsPreviewActions, type PointsPreview } from './points-preview-actions';
import { PointsResetAdvice } from './points-reset-advice';
import { hasApplicableGain } from '../model/points-preview-copy';
import { pointsPanelReading } from '../model/points-panel';

/**
 * Points panel shell (split): header (title, spent/level counter, Reset), the stat
 * table (rows via `PointsStatRow`, `SHEET_PANEL_KEYS` — 8, incl. Luck), and
 * the preview / Optimize build controls (`PointsPreviewActions`).
 *
 * Preview `{ pts, result }` is `useState` here — never a store field, never
 * `localStorage`. It is cleared by the SAME handler every `pts` mutation goes through
 * (`handlePtsMutate`) and, per-hero, by keying this whole component on `activeHeroId` at its
 * call site (`AdviceColumn`) — a remount, not an effect. Keying makes the reset a consequence of
 * identity changing; an effect keyed on `pts` would also fire on Apply and discard the vector it
 * just committed.
 */
/**
 * The callbacks a host supplies to make the panel editable. Absent, the same figures render with
 * no way to change them — see `pointsPanelReading`.
 *
 * `runFarmOptimize` is the host's own search, not a store read: the farm target needs the whole
 * rotation pool, and reaching for it from here would drag a roster-wide dependency onto a panel
 * that renders one hero.
 */
export type PointsTableEditing = {
  onPts: (next: Record<SheetKey, number>) => void;
  optimizeMode: RankMode;
  onOptimizeModeChange: (next: RankMode) => void;
  runFarmOptimize: () => HeroFarmOptimizeResult;
};

export function PointsTable({
  t,
  lang,
  level,
  pts,
  pipeline,
  heroBattleAllowed,
  editing,
}: {
  t: StatPanelCopy;
  lang: Lang;
  level: number;
  pts: Record<SheetKey, number>;
  pipeline: AdvisorPipelineResult;
  heroBattleAllowed: boolean;
  editing?: PointsTableEditing | undefined;
}) {
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);
  const reading = pointsPanelReading({ editable: !!editing, heroBattleAllowed });
  const { spentDelta, pointDelta, adjusted, resetAdvice } = pipeline;

  const [preview, setPreview] = useState<PointsPreview | null>(null);
  const [justApplied, setJustApplied] = useState(false);

  function handlePtsMutate(next: Record<SheetKey, number>) {
    setPreview(null);
    setJustApplied(false);
    editing?.onPts(next);
  }

  function handleOptimize() {
    // On demand, in the click handler only — never render, a selector, or an effect. That rule
    // is load-bearing for both targets and hardest for farm, whose every candidate costs a
    // squad-wide phase sweep.
    setJustApplied(false);
    if (!editing) return;
    if (editing.optimizeMode === 'farm') {
      const farm = editing.runFarmOptimize();
      setPreview({ mode: 'farm', pts: farm.pts, result: farm });
      return;
    }
    const result = optimizeBuild({
      pts,
      effective: pipeline.effective,
      effectiveDelta: pipeline.A.effectiveDelta,
      context: pipeline.context,
      level,
    });
    setPreview({ mode: 'dps', pts: result.pts, result });
  }

  function handleApply() {
    if (!preview) return;
    // Spec edge case: a search with no measurable gain is a no-op, not a rewrite of an
    // equally-scoring reshuffle — and no respec note for zero player benefit.
    if (hasApplicableGain(preview)) {
      // preview.pts already echoes pts.luck untouched — no special-casing needed.
      editing?.onPts(preview.pts);
      setJustApplied(true);
    }
    setPreview(null);
  }

  function handleClear() {
    setPreview(null);
  }

  // The same pool `optimizeBuild` searches over (`reoptBudget`) — a hero with 0 spent still has
  // its whole level to place, so the button must not read as disabled.
  const budget = reoptBudget(pts, level);
  // Derived from the live vector, never from the save's banked count: `statPointsAvailable` is
  // frozen at import, so it would keep advertising "+46 unspent" after those 46 were spent here.
  const unspent = Math.max(0, level - spentDelta);
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
          {unspent > 0 && (
            // Names what the counter above only implies — that this hero has points sitting
            // unplaced — so a reallocation the optimizer proposes reads as those points finally
            // being spent rather than as points appearing from nowhere.
            <span className={mutedClass}>{sub(t.pointsUnspentBanked, { count: unspent })}</span>
          )}
          {reading.showReset && (
            <Button type="button" onClick={() => handlePtsMutate(ZERO_PTS())}>
              {t.reset}
            </Button>
          )}
        </div>
      </div>
      {pointsExceedLevel(pts, level) && (
        // The counter above already turns red on this; it never said what to do about it.
        <p role="alert" className="m-0 mb-2 max-w-prose border-l-2 border-warn py-1 pl-2.5 text-xs leading-snug text-warn">
          {sub(t.pointsOverBudgetWarning, { spent: spentDelta, level })}
        </p>
      )}
      <PointsResetAdvice
        t={t}
        resetAdvice={resetAdvice}
        formatNumber={boundFormatNumber}
        enabled={reading.showResetAdvice}
      />
      <DataTable.Root>
        <DataTable.Table className="table-fixed">
          <colgroup>
            <col />
            <col className="w-42" />
            {/* content-fit-ui.md: widened for the 2 dp precision sweep. */}
            <col className="w-16" />
            <col className="w-24" />
            {reading.showPreviewActions ? <col className="w-24" /> : null}
          </colgroup>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header>{t.colStat}</DataTable.Header>
              <DataTable.Header align="center">Δ</DataTable.Header>
              <DataTable.Header align="right">{t.colPerPt}</DataTable.Header>
              <DataTable.Header align="right">{t.colAfter}</DataTable.Header>
              {/* The optimizer's proposal, so only where there is an optimizer to make one. */}
              {reading.showPreviewActions ? (
                <DataTable.Header align="right">{t.colPreview}</DataTable.Header>
              ) : null}
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
                onPts={reading.showPointSteppers ? handlePtsMutate : undefined}
                formatNumber={boundFormatNumber}
                showPreview={reading.showPreviewActions}
              />
            ))}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
      {reading.showPreviewActions && editing && (
        <PointsPreviewActions
          t={t}
          preview={preview}
          justApplied={justApplied}
          optimize={{
            disabled: budget <= 0,
            disabledReason: budget <= 0 ? t.optimizeBuildNoBudgetReason : null,
            mode: editing.optimizeMode,
            onModeChange: editing.onOptimizeModeChange,
            heroEnabled: heroBattleAllowed,
          }}
          formatNumber={boundFormatNumber}
          onOptimize={handleOptimize}
          onApply={handleApply}
          onClear={handleClear}
        />
      )}
    </Panel>
  );
}
