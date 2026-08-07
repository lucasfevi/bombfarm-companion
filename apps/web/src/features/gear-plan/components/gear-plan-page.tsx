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
  selectGearPlanIsStale,
  selectForgeFloor,
} from '@/shared/stores';
import { defaultScopeForHero } from '@/shared/stores/gear-plan/types';
import { useGearPlanRunner } from '@/features/gear-plan/hooks/use-gear-plan-runner';
import { GearPlanEmptyPanel } from './gear-plan-empty';
import { GearPlanToolbar } from './gear-plan-toolbar';
import { GearPlanRunSummary } from './gear-plan-run-summary';
import { GearPlanOptimizingModal } from './gear-plan-optimizing-modal';
import { ScopeList } from './scope-list';
import { WaterfallPanel } from './waterfall-panel';
import { HeroDeltaTable } from './hero-delta-table';
import { ForgeList } from './forge-list';
import { MoveList } from './move-list';
import { PointResetList } from './point-reset-list';
import { PlanDisclosures } from './plan-disclosures';
import { SendToAltLoadout } from './send-to-alt-loadout';

export function GearPlanPage({
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
  const isStale = usePlannerStore(selectGearPlanIsStale);
  const forgeFloor = usePlannerStore(selectForgeFloor);
  const clearPlan = usePlannerStore((state) => state.clearPlan);
  const runner = useGearPlanRunner();
  const resultsRef = useRef<HTMLElement | null>(null);
  const wasRunningRef = useRef(false);

  const hasRoster = heroes.length > 0;
  const hasInventory = inventory.length > 0;
  const optimizeCount = heroes.filter(
    (hero) => (scopeByHeroId[hero.id] ?? defaultScopeForHero(hero.battleAllowed)) === 'optimize',
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
      <GearPlanToolbar t={t} runner={runner} />
      <ScopeList t={t} lang={lang} />
    </>
  );

  return (
    <div className={workspaceClass}>
      <GearPlanOptimizingModal
        open={isRunning}
        t={t}
        onCancel={() => {
          runner.cancel();
          clearPlan();
        }}
      />
      <section role="region" aria-label={t.gearPlanPageLandmark}>
        <header className="mb-4">
          <h1 className="m-0 text-lg font-bold text-ink">{t.gearPlanPageTitle}</h1>
        </header>

        {!hasRoster ? (
          <GearPlanEmptyPanel
            title={t.gearPlanEmptyNoRosterTitle}
            body={t.gearPlanEmptyNoRosterBody}
            cta={t.gearPlanImportCta}
            onImport={onImport}
          />
        ) : !hasInventory ? (
          <GearPlanEmptyPanel
            title={t.gearPlanEmptyNoInventoryTitle}
            body={t.gearPlanEmptyNoInventoryBody}
            cta={t.gearPlanImportCta}
            onImport={onImport}
          />
        ) : allLeaveAlone ? (
          <div className="flex flex-col gap-4">
            {setupAndScope}
            <GearPlanEmptyPanel
              title={t.gearPlanEmptyAllLeaveAloneTitle}
              body={t.gearPlanEmptyAllLeaveAloneBody}
              cta={t.gearPlanImportCta}
              onImport={onImport}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {setupAndScope}

            {(runStatus === 'blocked' || runner.status === 'blocked') && blockedNames.length > 0 ? (
              <div className="rounded-sm border border-warn/50 bg-[color-mix(in_oklch,var(--warn)_10%,transparent)] px-4 py-3">
                <h2 className="m-0 text-sm font-semibold text-ink">{t.gearPlanBlockedTitle}</h2>
                <p className="m-0 mt-1 text-[13px] text-muted">
                  {sub(t.gearPlanBlockedBody, { heroes: blockedNames.join(', ') })}
                </p>
              </div>
            ) : null}

            {(runStatus === 'error' || runner.status === 'error') && runner.errorMessage ? (
              <div className="rounded-sm border border-down/40 px-4 py-3">
                <h2 className="m-0 text-sm font-semibold text-ink">{t.gearPlanErrorTitle}</h2>
                <p className="m-0 mt-1 text-[13px] text-muted">{runner.errorMessage}</p>
                <Button type="button" className="mt-2" variant="default" onClick={() => clearPlan()}>
                  {t.gearPlanRetry}
                </Button>
              </div>
            ) : null}

            {isStale && displayPlan ? (
              <p className="m-0 text-sm text-warn" role="status">
                {t.gearPlanStaleNotice}
              </p>
            ) : null}

            {displayPlan ? (
              <section
                ref={resultsRef}
                aria-label={t.gearPlanResultsSectionAria}
                className="scroll-mt-20 rounded-sm border border-accent/35 bg-[color-mix(in_oklch,var(--accent)_6%,transparent)] p-3"
              >
                <h2 className="m-0 mb-3 text-sm font-bold tracking-wide text-ink uppercase">
                  {t.gearPlanResultsSectionTitle}
                </h2>
                <div className="flex flex-col gap-4">
                  <GearPlanRunSummary
                    t={t}
                    plan={displayPlan}
                    ranOnMainThread={runner.ranOnMainThread}
                  />
                  <WaterfallPanel t={t} plan={displayPlan} />
                  <HeroDeltaTable t={t} plan={displayPlan} />
                  <ForgeList t={t} plan={displayPlan} />
                  <MoveList t={t} plan={displayPlan} />
                  <PointResetList t={t} plan={displayPlan} />
                  <PlanDisclosures t={t} plan={displayPlan} requestedForgeFloor={forgeFloor} />
                  <SendToAltLoadout t={t} plan={displayPlan} />
                </div>
              </section>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
