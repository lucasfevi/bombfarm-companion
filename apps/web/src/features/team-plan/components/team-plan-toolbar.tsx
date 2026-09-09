'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button, Panel } from '@bombfarm/ui';
import { mayMoveGear, mayRespendPoints } from '@bombfarm/domain/team-plan';
import type { TeamPlanAllowedChanges } from '@bombfarm/domain/team-plan/types';
import { panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui/panel-field.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import type { TeamPlanRunner } from '@/features/team-plan/hooks/use-team-plan-runner';
import {
  buildTeamPlanInputFromStore,
  countOptimizeScopeHeroes,
} from '@/features/team-plan/model/build-team-plan-input';
import {
  usePlannerStore,
  selectTeamPlanAllowedChanges,
  selectTeamPlanObjective,
  selectTeamPlanFarmUnavailable,
} from '@/shared/stores';
import { teamPlanObjectiveCopy } from '@/features/team-plan/model/objective-copy';
import { AllowedChangesField } from './allowed-changes-field';
import { ForgeFloorField } from './forge-floor-field';
import { IgnoreCrowdingField } from './ignore-crowding-field';
import { ObjectiveField } from './objective-field';
import { PhaseField } from './phase-field';

/**
 * The button's accessible name has to follow Allowed changes: a points-only plan moves no gear,
 * so an unconditional "gear moves and point resets" describes work it will not do to the one
 * reader who cannot see the control that ruled it out.
 */
function optimizeAriaFor(strings: Strings, allowedChanges: TeamPlanAllowedChanges): string {
  if (!mayMoveGear(allowedChanges)) return strings.teamPlanOptimizeAriaPoints;
  if (!mayRespendPoints(allowedChanges)) return strings.teamPlanOptimizeAriaGear;
  return strings.teamPlanOptimizeAriaBoth;
}

export function TeamPlanToolbar({
  t,
  lang,
  runner,
}: {
  t: Strings;
  lang: Lang;
  runner: TeamPlanRunner;
}) {
  const startRun = usePlannerStore((state) => state.startRun);
  const applyPlan = usePlannerStore((state) => state.applyPlan);
  const resolveRun = usePlannerStore((state) => state.resolveRun);
  const runStatus = usePlannerStore((state) => state.runStatus);
  const scopeEmpty = usePlannerStore((state) => countOptimizeScopeHeroes(state) === 0);
  const objective = usePlannerStore(selectTeamPlanObjective);
  const allowedChanges = usePlannerStore(selectTeamPlanAllowedChanges);
  const farmUnavailable = usePlannerStore(selectTeamPlanFarmUnavailable);
  const copy = teamPlanObjectiveCopy(t, objective);
  const farmBlocked = objective === 'farm' && farmUnavailable;
  const handledRunId = useRef<string | null>(null);

  const handleOptimize = useCallback(() => {
    const state = usePlannerStore.getState();
    if (countOptimizeScopeHeroes(state) === 0) return;
    if (state.objective === 'farm' && selectTeamPlanFarmUnavailable(state)) return;
    handledRunId.current = null;
    runner.run(buildTeamPlanInputFromStore(state));
  }, [runner]);

  useEffect(() => {
    const runId = runner.runId;
    if (!runId) return;
    if (runner.status === 'running') {
      startRun(runId);
      return;
    }
    if (handledRunId.current === runId) return;
    handledRunId.current = runId;
    if (runner.status === 'done' && runner.plan) {
      applyPlan(runId, runner.plan);
      return;
    }
    if (runner.status === 'blocked') {
      resolveRun(runId, 'blocked');
      return;
    }
    if (runner.status === 'error') {
      resolveRun(runId, 'error');
    }
  }, [runner, startRun, applyPlan, resolveRun]);

  const busy = runner.status === 'running' || runStatus === 'running';

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
          <ObjectiveField t={t} copy={copy} />
          <PhaseField t={t} lang={lang} copy={copy} />
          <AllowedChangesField t={t} />
          {/* A points-only plan is scored at the items' real forge levels and orders no forge
              work, so a floor the player can still set would be a control that does nothing. */}
          {allowedChanges === 'points' ? null : <ForgeFloorField t={t} />}
          <IgnoreCrowdingField t={t} />
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={busy || scopeEmpty || farmBlocked}
          aria-busy={busy}
          aria-label={optimizeAriaFor(t, allowedChanges)}
          className="min-h-12 w-full shrink-0 px-8 text-sm sm:w-auto sm:min-w-52"
          onClick={handleOptimize}
        >
          {busy ? t.teamPlanOptimizing : t.teamPlanOptimize}
        </Button>
      </div>
    </Panel>
  );
}
