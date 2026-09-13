'use client';

import { useAppLang } from '@/shared/context/app-lang';
import {
  selectOptimizeScopeHeroCount,
  selectTeamPlanFarmUnavailable,
  selectTeamPlanInputsUsable,
  selectTeamPlanObjective,
  usePlannerStore,
} from '@/shared/stores';
import { selectHasGearPool, selectHasRoster } from '../model/home-selectors';
import { HomeSectionCard } from './home-section-card';

export function OptimizerCard() {
  const { t } = useAppLang();
  const hasRoster = usePlannerStore(selectHasRoster);
  const hasGearPool = usePlannerStore(selectHasGearPool);
  const scopeCount = usePlannerStore(selectOptimizeScopeHeroCount);
  const objective = usePlannerStore(selectTeamPlanObjective);
  const farmUnavailable = usePlannerStore(selectTeamPlanFarmUnavailable);
  const inputsUsable = usePlannerStore(selectTeamPlanInputsUsable);

  const needsLine = !hasRoster
    ? t.teamPlanEmptyNoRosterTitle
    : !hasGearPool
      ? t.teamPlanEmptyNoInventoryTitle
      : scopeCount === 0
        ? t.teamPlanEmptyAllLeaveAloneTitle
        : objective === 'farm' && farmUnavailable
          ? t.teamPlanObjectiveFarmNeedsMaxPhase
          : null;

  return (
    <HomeSectionCard
      section="optimizer"
      state={inputsUsable ? 'ready' : 'needs'}
      context={t.homeCardOptimizerContext}
      footer={inputsUsable ? null : needsLine}
    >
      <p className="m-0">{t.homeCardOptimizerReady}</p>
    </HomeSectionCard>
  );
}
