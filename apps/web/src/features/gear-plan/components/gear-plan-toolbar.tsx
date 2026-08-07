'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button, Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import type { GearPlanRunner } from '@/features/gear-plan/hooks/use-gear-plan-runner';
import { countOptimizeScopeHeroes } from '@/features/gear-plan/model/build-gear-plan-input';
import { buildGearPlanInputFromStore } from '@/features/gear-plan/model/build-gear-plan-input';
import { usePlannerStore } from '@/shared/stores';
import { GearPlanRunSummary } from './gear-plan-run-summary';

export function GearPlanToolbar({ t, runner }: { t: Strings; runner: GearPlanRunner }) {
  const startRun = usePlannerStore((state) => state.startRun);
  const applyPlan = usePlannerStore((state) => state.applyPlan);
  const resolveRun = usePlannerStore((state) => state.resolveRun);
  const plan = usePlannerStore((state) => state.plan);
  const runStatus = usePlannerStore((state) => state.runStatus);
  const handledRunId = useRef<string | null>(null);

  const handleOptimize = useCallback(() => {
    const state = usePlannerStore.getState();
    if (countOptimizeScopeHeroes(state) === 0) return;
    handledRunId.current = null;
    runner.run(buildGearPlanInputFromStore(state));
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
  const displayPlan = runner.plan ?? plan;

  return (
    <Panel focus>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanOptimize}</h2>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={busy}
          aria-busy={busy}
          aria-label={t.gearPlanOptimizeAria}
          onClick={handleOptimize}
        >
          {busy ? t.gearPlanOptimizing : t.gearPlanOptimize}
        </Button>
      </div>
      {displayPlan ? (
        <GearPlanRunSummary t={t} plan={displayPlan} ranOnMainThread={runner.ranOnMainThread} />
      ) : null}
    </Panel>
  );
}
