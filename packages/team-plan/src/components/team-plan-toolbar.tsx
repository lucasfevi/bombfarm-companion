'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button, Panel, panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui';
import type { Lang } from '@bombfarm/hero/copy';
import { buildTeamPlanInput, countOptimizeScopeHeroes, isFarmObjectiveUnavailable } from '../core';
import { resolveTeamPlanTargetPhase } from '../core/plan-lifecycle';
import type { TeamPlanScreenCopy } from '../copy';
import { teamPlanObjectiveCopy } from '../model/objective-copy';
import { optimizeAriaFor } from '../model/setup-copy';
import type { TeamPlanRunner } from '../runner';
import type { TeamPlanScreenActions, TeamPlanScreenData } from './team-plan-screen';
import { AllowedChangesField } from './allowed-changes-field';
import { ForgeFloorField } from './forge-floor-field';
import { IgnoreCrowdingField } from './ignore-crowding-field';
import { ObjectiveField } from './objective-field';
import { PhaseField } from './phase-field';

export function TeamPlanToolbar({
  t,
  lang,
  data,
  actions,
  runner,
}: {
  t: TeamPlanScreenCopy;
  lang: Lang;
  data: TeamPlanScreenData;
  actions: TeamPlanScreenActions;
  runner: TeamPlanRunner;
}) {
  const copy = teamPlanObjectiveCopy(t, data.controls.objective);
  const resolvedTargetPhase = resolveTeamPlanTargetPhase(data.inputs, data.controls);
  const farmUnavailable = isFarmObjectiveUnavailable(data.inputs.maxPhase, resolvedTargetPhase);
  const farmBlocked = data.controls.objective === 'farm' && farmUnavailable;
  const scopeEmpty = countOptimizeScopeHeroes(data.inputs.heroes, data.controls.scopeByHeroId) === 0;
  const handledRunId = useRef<string | null>(null);
  // A run that falls back to the main thread computes synchronously inside the same click that
  // started it, so React's automatic batching can coalesce the 'running' and the terminal state
  // into the ONE render this effect sees — this ref makes `startRun` fire for a runId exactly
  // once regardless of whether an intermediate 'running' render happened to exist to observe.
  // Without it, a host whose `applyPlan`/`resolveRun` key off the runId `startRun` recorded (so a
  // later Refresh mid-run cannot silently re-key an in-flight plan) never sees that runId at all,
  // and silently drops the finished plan.
  const startedRunId = useRef<string | null>(null);

  const handleOptimize = useCallback(() => {
    if (countOptimizeScopeHeroes(data.inputs.heroes, data.controls.scopeByHeroId) === 0) return;
    if (data.controls.objective === 'farm' && farmUnavailable) return;
    handledRunId.current = null;
    runner.run(buildTeamPlanInput(data.inputs, data.controls));
  }, [runner, data.inputs, data.controls, farmUnavailable]);

  useEffect(() => {
    const runId = runner.runId;
    if (!runId) return;
    if (startedRunId.current !== runId) {
      startedRunId.current = runId;
      actions.startRun(runId);
    }
    if (runner.status === 'running') return;
    if (handledRunId.current === runId) return;
    handledRunId.current = runId;
    if (runner.status === 'done' && runner.plan) {
      actions.applyPlan(runId, runner.plan);
      return;
    }
    if (runner.status === 'blocked') {
      actions.resolveRun(runId, 'blocked');
      return;
    }
    if (runner.status === 'error') {
      actions.resolveRun(runId, 'error');
    }
  }, [runner, actions]);

  const busy = runner.status === 'running' || data.runStatus === 'running';

  return (
    <Panel focus>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.teamPlanSetupSectionTitle}</h2>
      </div>
      <p className={tipClass}>{copy.setupSectionBody}</p>
      {farmBlocked ? (
        <p className="m-0 mt-2 text-[13px] text-warn" role="status">
          {t.teamPlanObjectiveFarmNeedsMaxPhase}
        </p>
      ) : null}
      {/* The button centres against the field block rather than sitting on its bottom edge — the
          fields' hints are of different lengths, so the row's bottom is wherever the longest hint
          ends and has nothing to do with where the button belongs. */}
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-6">
        {/* The fields align on their TOPS, not the row's centre or bottom: each carries a hint of
            its own length below the control, so aligning them any other way steps the controls
            down like a staircase. Their labels are one line and share a class, so a shared top
            edge puts every control on the same line. */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-6">
          <ObjectiveField
            t={t}
            copy={copy}
            value={data.controls.objective}
            onChange={actions.setObjective}
          />
          <PhaseField
            t={t}
            lang={lang}
            copy={copy}
            value={resolvedTargetPhase}
            maxPhase={data.inputs.maxPhase}
            onChange={actions.setTargetPhase}
          />
          <AllowedChangesField t={t} value={data.controls.allowedChanges} onChange={actions.setAllowedChanges} />
          {/* A points-only plan is scored at the items' real forge levels and orders no forge
              work, so a floor the player can still set would be a control that does nothing. */}
          {data.controls.allowedChanges === 'points' ? null : (
            <ForgeFloorField t={t} value={data.controls.forgeFloor} onChange={actions.setForgeFloor} />
          )}
          <IgnoreCrowdingField
            t={t}
            value={data.controls.ignoreFieldCrowding}
            onChange={actions.setIgnoreFieldCrowding}
          />
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={busy || scopeEmpty || farmBlocked}
          aria-busy={busy}
          aria-label={optimizeAriaFor(t, data.controls.allowedChanges)}
          className="min-h-12 w-full shrink-0 px-8 text-sm sm:w-auto sm:min-w-52"
          onClick={handleOptimize}
        >
          {busy ? t.teamPlanOptimizing : t.teamPlanOptimize}
        </Button>
      </div>
    </Panel>
  );
}
