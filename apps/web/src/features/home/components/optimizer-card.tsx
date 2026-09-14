'use client';

import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { useTeamPlanSolver } from '@/shared/hooks/use-team-plan-solver';
import { sub } from '@/shared/i18n';
import {
  selectHeroes,
  selectInventoryItems,
  selectOptimizeScopeHeroCount,
  selectTeamPlanFarmUnavailable,
  selectTeamPlanInputsUsable,
  selectTeamPlanIsStale,
  selectTeamPlanObjective,
  usePlannerStore,
} from '@/shared/stores';
import { selectHasGearPool, selectHasRoster } from '../model/home-selectors';
import { belowFloor, planActions } from '../model/optimizer-actions';
import { optimizerCardState } from '../model/optimizer-card-state';
import { useElapsedSeconds } from '../model/use-elapsed-seconds';
import { useHomeSolveRequest } from '../model/use-home-solve-request';
import { HomeSectionCard } from './home-section-card';
import { OptimizerCardSkeleton } from './optimizer-card-skeleton';
import { OptimizerPlanBody } from './optimizer-plan-body';
import { OptimizerPlanFooter } from './optimizer-plan-footer';

export function OptimizerCard() {
  const { t, lang } = useAppLang();
  const hasRoster = usePlannerStore(selectHasRoster);
  const hasGearPool = usePlannerStore(selectHasGearPool);
  const scopeCount = usePlannerStore(selectOptimizeScopeHeroCount);
  const objective = usePlannerStore(selectTeamPlanObjective);
  const farmUnavailable = usePlannerStore(selectTeamPlanFarmUnavailable);
  const inputsUsable = usePlannerStore(selectTeamPlanInputsUsable);
  const heroes = usePlannerStore(selectHeroes);
  const inventory = usePlannerStore(selectInventoryItems);
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

  const actions = plan ? planActions(plan, inventory, heroes, t, lang) : null;
  const underFloor = plan ? belowFloor(plan) : false;
  const state = optimizerCardState({ inputsUsable, runStatus, plan, stale, belowFloor: underFloor });

  let body: ReactNode = null;
  let footer: ReactNode = null;
  switch (state) {
    case 'needs':
      footer = needsLine;
      break;
    case 'skeleton':
      body = <OptimizerCardSkeleton />;
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
      if (underFloor) {
        body = <p className="m-0 text-sm">{t.farmRespecNotWorthTitle}</p>;
        footer = <OptimizerPlanFooter moves={0} resets={0} t={t} />;
      } else if (plan && actions) {
        body = <OptimizerPlanBody plan={plan} actions={actions} objective={objective} t={t} lang={lang} />;
        footer = <OptimizerPlanFooter moves={actions.moves} resets={actions.resets} t={t} />;
      }
  }

  return (
    <HomeSectionCard
      section="optimizer"
      state={state}
      context={state === 'recalculating' ? t.homeCardOptimizerRecalculating : t.homeCardOptimizerContext}
      footer={footer}
    >
      {body}
    </HomeSectionCard>
  );
}
