'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Button, workspaceClass } from '@bombfarm/ui';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { TeamPlanAllowedChanges, TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import type { TeamPlan } from '@bombfarm/domain/team-plan/types';
import type { TeamPlanInputs, TeamPlanControls, ScopeState, TeamPlanRunStatus } from '../core';
import type { TeamPlanScreenCopy } from '../copy';
import { teamPlanObjectiveCopy } from '../model/objective-copy';
import { teamPlanEmptyState, type TeamPlanEmptyStateKind } from '../model/empty-state';
import {
  useTeamPlanRunner,
  type TeamPlanRunnerHandle,
  type TeamPlanWorkerFactory,
} from '../runner';
import { TeamPlanToolbar } from './team-plan-toolbar';
import { ScopeList } from './scope-list';
import { TeamPlanRunSummary } from './team-plan-run-summary';
import { TeamPlanOptimizingModal } from './team-plan-optimizing-modal';
import { WaterfallPanel } from './waterfall-panel';
import { HeroDeltaTable } from './hero-delta-table';

export type TeamPlanScreenData = {
  inputs: TeamPlanInputs;
  controls: TeamPlanControls;
  /** The host's settled plan — `null` until applyPlan, and again after any clear. */
  plan: TeamPlan | null;
  runStatus: TeamPlanRunStatus;
  runId: string | null;
  isStale: boolean;
};

export type TeamPlanScreenActions = {
  setScope: (heroId: string, scope: ScopeState) => void;
  setForgeFloor: (value: number) => void;
  setObjective: (value: TeamPlanObjective) => void;
  setAllowedChanges: (value: TeamPlanAllowedChanges) => void;
  setIgnoreFieldCrowding: (value: boolean) => void;
  setTargetPhase: (value: number | null) => void;
  startRun: (runId: string) => void;
  resolveRun: (runId: string, status: Exclude<TeamPlanRunStatus, 'running'>) => void;
  applyPlan: (runId: string, plan: TeamPlan) => void;
  clearPlan: () => void;
};

export type TeamPlanScreenSlots = {
  emptyState: (kind: TeamPlanEmptyStateKind) => ReactNode;
  /** Painted over the empty space to the right of the heading, costing the screen no height —
   *  the desktop puts its refresh control there, as it does on the farm board. Undefined renders
   *  nothing at all (no empty wrapper), so the web's DOM is unchanged. */
  headerOverlay?: ReactNode;
};

export function TeamPlanScreenView({
  t,
  lang,
  data,
  actions,
  slots,
  runner,
  createWorker,
}: {
  t: TeamPlanScreenCopy;
  lang: Lang;
  data: TeamPlanScreenData;
  actions: TeamPlanScreenActions;
  slots: TeamPlanScreenSlots;
  /** A host-built runner (window-lifetime singleton) — the screen subscribes to it instead of
   *  creating its own, so a solve survives the screen unmounting. Absent: today's behaviour. */
  runner?: TeamPlanRunnerHandle;
  createWorker?: TeamPlanWorkerFactory;
}) {
  const { inputs, controls } = data;
  const heroes = inputs.heroes;
  const inventoryItems = inputs.inventory.items;
  const runnerState = useTeamPlanRunner({
    ...(runner !== undefined ? { runner } : {}),
    ...(createWorker !== undefined ? { createWorker } : {}),
  });
  const resultsRef = useRef<HTMLElement | null>(null);
  const wasRunningRef = useRef(false);

  const objectiveCopy = teamPlanObjectiveCopy(t, controls.objective);
  const emptyStateKind = teamPlanEmptyState(heroes, inventoryItems, controls.scopeByHeroId);
  const allLeaveAlone = emptyStateKind === 'allLeaveAlone';

  // Only trust the runner's in-flight/just-finished plan while it matches the host's current
  // run — setScope/clearPlan reset the host's runId (and plan) to invalidate stale results
  // without also reaching into the runner hook, so a runId mismatch means the runner is still
  // holding a plan the host has since cleared.
  const displayPlan =
    runnerState.runId !== null && runnerState.runId === data.runId ? (runnerState.plan ?? data.plan) : data.plan;
  const blockedNames = runnerState.blockedHeroNames;
  const isRunning = data.runStatus === 'running' || runnerState.status === 'running';

  useEffect(() => {
    const finishedRun = wasRunningRef.current && !isRunning && !!displayPlan;
    wasRunningRef.current = isRunning;
    if (!finishedRun) return;
    // Defer one frame so the results section is mounted before scrolling.
    const frame = window.requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isRunning, displayPlan]);

  const setupAndScope = (
    <>
      <TeamPlanToolbar t={t} lang={lang} data={data} actions={actions} runner={runnerState} />
      <ScopeList t={t} lang={lang} heroes={heroes} scopeByHeroId={controls.scopeByHeroId} onScope={actions.setScope} />
    </>
  );

  return (
    <div className={workspaceClass}>
      <TeamPlanOptimizingModal
        open={isRunning}
        t={t}
        onCancel={() => {
          runnerState.cancel();
          actions.clearPlan();
        }}
      />
      <section role="region" aria-label={t.teamPlanPageLandmark}>
        <header className="relative mb-4">
          <h1 className="m-0 text-lg font-bold text-ink">{t.teamPlanPageTitle}</h1>
          {slots.headerOverlay ? <div className="absolute top-0 right-0">{slots.headerOverlay}</div> : null}
        </header>

        {emptyStateKind === 'noRoster' || emptyStateKind === 'noInventory' ? (
          slots.emptyState(emptyStateKind)
        ) : allLeaveAlone ? (
          <div className="flex flex-col gap-4">
            {setupAndScope}
            {slots.emptyState('allLeaveAlone')}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {setupAndScope}

            {(data.runStatus === 'blocked' || runnerState.status === 'blocked') && blockedNames.length > 0 ? (
              <div className="rounded-sm border border-warn/50 bg-[color-mix(in_oklch,var(--warn)_10%,transparent)] px-4 py-3">
                <h2 className="m-0 text-sm font-semibold text-ink">{t.teamPlanBlockedTitle}</h2>
                <p className="m-0 mt-1 text-[13px] text-muted">
                  {sub(t.teamPlanBlockedBody, { heroes: blockedNames.join(', ') })}
                </p>
              </div>
            ) : null}

            {(data.runStatus === 'error' || runnerState.status === 'error') && runnerState.errorMessage ? (
              <div className="rounded-sm border border-down/40 px-4 py-3">
                <h2 className="m-0 text-sm font-semibold text-ink">{t.teamPlanErrorTitle}</h2>
                <p className="m-0 mt-1 text-[13px] text-muted">{runnerState.errorMessage}</p>
                <Button type="button" className="mt-2" variant="default" onClick={() => actions.clearPlan()}>
                  {t.teamPlanRetry}
                </Button>
              </div>
            ) : null}

            {data.isStale && displayPlan ? (
              <p className="m-0 text-sm text-warn" role="status">
                {t.teamPlanStaleNotice}
              </p>
            ) : null}

            {displayPlan ? (
              <section
                ref={resultsRef}
                aria-label={t.teamPlanResultsSectionAria}
                className="scroll-mt-20 rounded-sm border border-accent/35 bg-[color-mix(in_oklch,var(--accent)_6%,transparent)] p-3"
              >
                <h2 className="m-0 mb-3 text-sm font-bold tracking-wide text-ink uppercase">
                  {t.teamPlanResultsSectionTitle}
                </h2>
                <div className="flex flex-col gap-4">
                  <TeamPlanRunSummary
                    t={t}
                    lang={lang}
                    plan={displayPlan}
                    ranOnMainThread={runnerState.ranOnMainThread}
                    copy={objectiveCopy}
                  />
                  <WaterfallPanel t={t} lang={lang} plan={displayPlan} copy={objectiveCopy} />
                  <HeroDeltaTable
                    t={t}
                    lang={lang}
                    plan={displayPlan}
                    copy={objectiveCopy}
                    heroes={heroes}
                    inventoryItems={inventoryItems}
                  />
                </div>
              </section>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
