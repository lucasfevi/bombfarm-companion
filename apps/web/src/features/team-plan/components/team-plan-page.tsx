'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@bombfarm/ui';
import { workspaceClass } from '@bombfarm/ui/panel-field.recipe';
import type { Lang, Strings } from '@/shared/i18n';
import { sub } from '@/shared/i18n';
import {
  usePlannerStore,
  selectHeroes,
  selectInventoryItems,
  selectTeamPlanIsStale,
  selectForgeFloor,
} from '@/shared/stores';
import { resolveHeroScope } from '@/shared/stores/team-plan/types';
import { useTeamPlanRunner } from '@/features/team-plan/hooks/use-team-plan-runner';
import { TeamPlanEmptyPanel } from './team-plan-empty';
import { TeamPlanToolbar } from './team-plan-toolbar';
import { TeamPlanRunSummary } from './team-plan-run-summary';
import { TeamPlanOptimizingModal } from './team-plan-optimizing-modal';
import { ScopeList } from './scope-list';
import { WaterfallPanel } from './waterfall-panel';
import { HeroDeltaTable } from './hero-delta-table';
import { PlanDisclosures } from './plan-disclosures';

export function TeamPlanPage({
  t,
  lang,
  onImport,
}: {
  t: Strings;
  lang: Lang;
  onImport: () => void;
}) {
  const heroes = usePlannerStore(selectHeroes);
  const inventory = usePlannerStore(selectInventoryItems);
  const plan = usePlannerStore((state) => state.plan);
  const runStatus = usePlannerStore((state) => state.runStatus);
  const scopeByHeroId = usePlannerStore((state) => state.scopeByHeroId);
  const isStale = usePlannerStore(selectTeamPlanIsStale);
  const forgeFloor = usePlannerStore(selectForgeFloor);
  const clearPlan = usePlannerStore((state) => state.clearPlan);
  const runner = useTeamPlanRunner();
  const resultsRef = useRef<HTMLElement | null>(null);
  const wasRunningRef = useRef(false);

  const hasRoster = heroes.length > 0;
  const hasInventory = inventory.length > 0;
  const optimizeCount = heroes.filter(
    (hero) => resolveHeroScope(hero, scopeByHeroId) === 'optimize',
  ).length;
  const allLeaveAlone = hasRoster && optimizeCount === 0;

  const displayPlan = runner.plan ?? plan;
  const blockedNames = runner.blockedHeroNames;
  const isRunning = runStatus === 'running' || runner.status === 'running';

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
      <TeamPlanToolbar t={t} runner={runner} />
      <ScopeList t={t} lang={lang} />
    </>
  );

  return (
    <div className={workspaceClass}>
      <TeamPlanOptimizingModal
        open={isRunning}
        t={t}
        onCancel={() => {
          runner.cancel();
          clearPlan();
        }}
      />
      <section role="region" aria-label={t.teamPlanPageLandmark}>
        <header className="mb-4">
          <h1 className="m-0 text-lg font-bold text-ink">{t.teamPlanPageTitle}</h1>
        </header>

        {!hasRoster ? (
          <TeamPlanEmptyPanel
            title={t.teamPlanEmptyNoRosterTitle}
            body={t.teamPlanEmptyNoRosterBody}
            cta={t.teamPlanImportCta}
            onImport={onImport}
          />
        ) : !hasInventory ? (
          <TeamPlanEmptyPanel
            title={t.teamPlanEmptyNoInventoryTitle}
            body={t.teamPlanEmptyNoInventoryBody}
            cta={t.teamPlanImportCta}
            onImport={onImport}
          />
        ) : allLeaveAlone ? (
          <div className="flex flex-col gap-4">
            {setupAndScope}
            <TeamPlanEmptyPanel
              title={t.teamPlanEmptyAllLeaveAloneTitle}
              body={t.teamPlanEmptyAllLeaveAloneBody}
              cta={t.teamPlanImportCta}
              onImport={onImport}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {setupAndScope}

            {(runStatus === 'blocked' || runner.status === 'blocked') && blockedNames.length > 0 ? (
              <div className="rounded-sm border border-warn/50 bg-[color-mix(in_oklch,var(--warn)_10%,transparent)] px-4 py-3">
                <h2 className="m-0 text-sm font-semibold text-ink">{t.teamPlanBlockedTitle}</h2>
                <p className="m-0 mt-1 text-[13px] text-muted">
                  {sub(t.teamPlanBlockedBody, { heroes: blockedNames.join(', ') })}
                </p>
              </div>
            ) : null}

            {(runStatus === 'error' || runner.status === 'error') && runner.errorMessage ? (
              <div className="rounded-sm border border-down/40 px-4 py-3">
                <h2 className="m-0 text-sm font-semibold text-ink">{t.teamPlanErrorTitle}</h2>
                <p className="m-0 mt-1 text-[13px] text-muted">{runner.errorMessage}</p>
                <Button type="button" className="mt-2" variant="default" onClick={() => clearPlan()}>
                  {t.teamPlanRetry}
                </Button>
              </div>
            ) : null}

            {isStale && displayPlan ? (
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
                    plan={displayPlan}
                    ranOnMainThread={runner.ranOnMainThread}
                  />
                  <WaterfallPanel t={t} plan={displayPlan} />
                  <HeroDeltaTable t={t} lang={lang} plan={displayPlan} />
                  <PlanDisclosures
                    t={t}
                    lang={lang}
                    plan={displayPlan}
                    requestedForgeFloor={forgeFloor}
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
