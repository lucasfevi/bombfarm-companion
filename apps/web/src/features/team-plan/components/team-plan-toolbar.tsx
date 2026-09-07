'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button, Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui/panel-field.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import type { TeamPlanRunner } from '@/features/team-plan/hooks/use-team-plan-runner';
import {
  buildTeamPlanInputFromStore,
  countOptimizeScopeHeroes,
} from '@/features/team-plan/model/build-team-plan-input';
import {
  usePlannerStore,
  selectTeamPlanObjective,
  selectTeamPlanFarmUnavailable,
} from '@/shared/stores';
import { teamPlanObjectiveCopy } from '@/features/team-plan/model/objective-copy';
import { ForgeFloorField } from './forge-floor-field';
import { ObjectiveField } from './objective-field';
import { PhaseField } from './phase-field';

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
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between sm:gap-6">
        {/* The fields align on their TOPS, not the row's bottom: each carries a hint of its own
            length below the control, so bottom-aligning three of them steps the controls down
            like a staircase. Their labels are one line and share a class, so a shared top edge
            puts every control on the same line. */}
        <div className="flex min-w-0 flex-1 flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-6">
          <ObjectiveField t={t} copy={copy} />
          <PhaseField t={t} lang={lang} />
          <ForgeFloorField t={t} />
        </div>
        <Button
          type="button"
          variant="primary"
          disabled={busy || scopeEmpty || farmBlocked}
          aria-busy={busy}
          aria-label={t.teamPlanOptimizeAria}
          className="min-h-12 w-full shrink-0 px-8 text-sm sm:w-auto sm:min-w-52"
          onClick={handleOptimize}
        >
          {busy ? t.teamPlanOptimizing : t.teamPlanOptimize}
        </Button>
      </div>
    </Panel>
  );
}
