'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Button, InfoTip, Panel, Tooltip, panelHClass, panelTitleClass } from '@bombfarm/ui';
import type { Lang } from '@bombfarm/hero/copy';
import { buildTeamPlanInput, countOptimizeScopeHeroes, isFarmObjectiveUnavailable } from '../core';
import { resolveTeamPlanTargetPhase } from '../core/plan-lifecycle';
import type { TeamPlanScreenCopy } from '../copy';
import { teamPlanObjectiveCopy } from '../model/objective-copy';
import { optimizeAriaFor } from '../model/setup-copy';
import { runnerMarksAtMount, runnerMarksBeforeRun, runnerReports } from '../model/runner-reports';
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
  // Seeded from the runner as it stands at mount, never from nothing: a host-owned runner
  // outlives this screen, and a run it already finished was handed over on the mount that
  // started it — see `runnerMarksAtMount`.
  const marksRef = useRef(runnerMarksAtMount(runner));

  const handleOptimize = useCallback(() => {
    if (countOptimizeScopeHeroes(data.inputs.heroes, data.controls.scopeByHeroId) === 0) return;
    if (data.controls.objective === 'farm' && farmUnavailable) return;
    marksRef.current = runnerMarksBeforeRun(marksRef.current);
    runner.run(buildTeamPlanInput(data.inputs, data.controls));
  }, [runner, data.inputs, data.controls, farmUnavailable]);

  useEffect(() => {
    const { reports, marks } = runnerReports(runner, marksRef.current);
    marksRef.current = marks;
    for (const report of reports) {
      if (report.kind === 'startRun') actions.startRun(report.runId);
      else if (report.kind === 'applyPlan') actions.applyPlan(report.runId, report.plan);
      else actions.resolveRun(report.runId, report.status);
    }
  }, [runner, actions]);

  const busy = runner.status === 'running' || data.runStatus === 'running';

  return (
    <Panel focus>
      <Tooltip.Provider delay={180} closeDelay={80}>
        {/* The button centres against the whole panel — title, notice and fields — not the field
            row alone, so it sits at the panel's middle rather than a title's height below it. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className={panelHClass}>
              {/* The glyph sits beside the heading, not inside it, so the heading's accessible
                  name stays the title alone rather than the title plus the whole intro. */}
              <div className="flex items-center gap-1.5">
                <h2 className={panelTitleClass}>{t.teamPlanSetupSectionTitle}</h2>
                <InfoTip label={t.teamPlanSetupSectionTitle} tip={copy.setupSectionBody} />
              </div>
            </div>
            {farmBlocked ? (
              <p className="m-0 mb-2 text-[13px] text-warn" role="status">
                {t.teamPlanObjectiveFarmNeedsMaxPhase}
              </p>
            ) : null}
            {/* Tops, not centres: a field may carry a one-line warning under its control (a phase
                past the account's furthest), and centring would step the others down against it. */}
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:gap-5">
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
      </Tooltip.Provider>
    </Panel>
  );
}
