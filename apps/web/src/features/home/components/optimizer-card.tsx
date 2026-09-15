'use client';

import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { useTeamPlanSolver } from '@/shared/hooks/use-team-plan-solver';
import { sub } from '@/shared/i18n';
import {
  selectOptimizeScopeHeroCount,
  selectTeamPlanFarmUnavailable,
  selectTeamPlanInputsUsable,
  selectTeamPlanIsStale,
  selectTeamPlanObjective,
  usePlannerStore,
} from '@/shared/stores';
import { selectHasGearPool, selectHasRoster } from '../model/home-selectors';
import { optimizerCardState } from '../model/optimizer-card-state';
import { belowFloor } from '../model/optimizer-gain';
import { useElapsedSeconds } from '../model/use-elapsed-seconds';
import { useHomeSolveRequest } from '../model/use-home-solve-request';
import { HomeSectionCard } from './home-section-card';
import { OptimizerPlanBody } from './optimizer-plan-body';
import { OptimizerPlanLink } from './optimizer-plan-link';

export function OptimizerCard() {
  const { t, lang } = useAppLang();
  const hasRoster = usePlannerStore(selectHasRoster);
  const hasGearPool = usePlannerStore(selectHasGearPool);
  const scopeCount = usePlannerStore(selectOptimizeScopeHeroCount);
  const objective = usePlannerStore(selectTeamPlanObjective);
  const farmUnavailable = usePlannerStore(selectTeamPlanFarmUnavailable);
  const inputsUsable = usePlannerStore(selectTeamPlanInputsUsable);
  const plan = usePlannerStore((state) => state.plan);
  const runStatus = usePlannerStore((state) => state.runStatus);
  const runId = usePlannerStore((state) => state.runId);
  const stale = usePlannerStore(selectTeamPlanIsStale);
  const snapshot = useTeamPlanSolver();
  useHomeSolveRequest();
  const elapsed = useElapsedSeconds(runId, runStatus === 'running');

  const needsLine = !hasRoster
    ? t.teamPlanEmptyNoRosterTitle
    : !hasGearPool
      ? t.teamPlanEmptyNoInventoryTitle
      : scopeCount === 0
        ? t.teamPlanEmptyAllLeaveAloneTitle
        : objective === 'farm' && farmUnavailable
          ? t.teamPlanObjectiveFarmNeedsMaxPhase
          : null;

  const underFloor = plan !== null && belowFloor(plan);
  const state = optimizerCardState({ inputsUsable, runStatus, plan, stale, belowFloor: underFloor });

  let body: ReactNode = null;
  let footer: ReactNode = null;
  switch (state) {
    case 'needs':
      footer = needsLine;
      break;
    case 'optimizing':
      body = (
        <>
          <p className="m-0 text-xl font-bold text-ink" data-testid="home-optimizer-optimizing">
            {t.teamPlanOptimizingTitle}
          </p>
          <p className={cn(mutedClass, 'm-0 text-xs')}>{t.teamPlanOptimizingBody}</p>
        </>
      );
      footer = sub(t.homeCardOptimizerSearching, { elapsed });
      break;
    case 'blocked':
      body = (
        <>
          <p className="m-0 text-sm">{t.teamPlanBlockedTitle}</p>
          <p className={cn(mutedClass, 'm-0')}>
            {sub(t.teamPlanBlockedBody, { heroes: snapshot.blockedHeroNames.join(', ') })}
          </p>
        </>
      );
      break;
    case 'error':
      body = (
        <>
          <p className="m-0 text-sm">{t.teamPlanErrorTitle}</p>
          <p className={cn(mutedClass, 'm-0')}>{snapshot.errorMessage}</p>
        </>
      );
      break;
    default:
      if (plan) {
        body = (
          <>
            {underFloor ? (
              <p className="m-0 text-sm">{t.farmRespecNotWorthTitle}</p>
            ) : (
              <OptimizerPlanBody plan={plan} objective={objective} t={t} lang={lang} />
            )}
            <OptimizerPlanLink t={t} />
          </>
        );
      }
  }

  return (
    <HomeSectionCard
      section="optimizer"
      state={state}
      context={state === 'recalculating' ? t.homeCardOptimizerRecalculating : t.homeCardOptimizerContext}
      footer={footer}
      bodyClassName="flex flex-col gap-2"
    >
      {body}
    </HomeSectionCard>
  );
}
