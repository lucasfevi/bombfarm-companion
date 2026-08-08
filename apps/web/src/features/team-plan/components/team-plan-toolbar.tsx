'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button, Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import type { TeamPlanRunner } from '@/features/team-plan/hooks/use-team-plan-runner';
import {
  buildTeamPlanInputFromStore,
  countOptimizeScopeHeroes,
} from '@/features/team-plan/model/build-team-plan-input';
import { usePlannerStore } from '@/shared/stores';
import { ForgeFloorField } from './forge-floor-field';

export function TeamPlanToolbar({ t, runner }: { t: Strings; runner: TeamPlanRunner }) {
  const startRun = usePlannerStore((state) => state.startRun);
  const applyPlan = usePlannerStore((state) => state.applyPlan);
  const resolveRun = usePlannerStore((state) => state.resolveRun);
  const runStatus = usePlannerStore((state) => state.runStatus);
  const scopeEmpty = usePlannerStore((state) => countOptimizeScopeHeroes(state) === 0);
  const handledRunId = useRef<string | null>(null);

  const handleOptimize = useCallback(() => {
    const state = usePlannerStore.getState();
    if (countOptimizeScopeHeroes(state) === 0) return;
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
      <p className={tipClass}>{t.teamPlanSetupSectionBody}</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <ForgeFloorField t={t} />
        <Button
          type="button"
          variant="primary"
          disabled={busy || scopeEmpty}
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
