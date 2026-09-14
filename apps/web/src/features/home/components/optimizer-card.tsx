'use client';

import { formatPhaseLabel } from '@bombfarm/domain/phase-wiki';
import { useAppLang } from '@/shared/context/app-lang';
import { sub, type Strings } from '@/shared/i18n';
import {
  selectForgeFloor,
  selectHeroes,
  selectOptimizeScopeHeroCount,
  selectTeamPlanAllowedChanges,
  selectTeamPlanFarmUnavailable,
  selectTeamPlanInputsUsable,
  selectTeamPlanObjective,
  selectTeamPlanTargetPhase,
  usePlannerStore,
  type PlannerStore,
} from '@/shared/stores';
import { selectHasGearPool, selectHasRoster } from '../model/home-selectors';
import { HomeKeyValues } from './home-key-values';
import { HomeSectionCard } from './home-section-card';

const OBJECTIVE_KEY = {
  dps: 'teamPlanObjectiveOptionDamage',
  farm: 'teamPlanObjectiveOptionGold',
} as const satisfies Record<PlannerStore['objective'], keyof Strings>;

const ALLOWED_CHANGES_KEY = {
  both: 'teamPlanAllowedChangesOptionBoth',
  points: 'teamPlanAllowedChangesOptionPoints',
  gear: 'teamPlanAllowedChangesOptionGear',
} as const satisfies Record<PlannerStore['allowedChanges'], keyof Strings>;

export function OptimizerCard() {
  const { t, lang } = useAppLang();
  const hasRoster = usePlannerStore(selectHasRoster);
  const hasGearPool = usePlannerStore(selectHasGearPool);
  const heroes = usePlannerStore(selectHeroes);
  const scopeCount = usePlannerStore(selectOptimizeScopeHeroCount);
  const objective = usePlannerStore(selectTeamPlanObjective);
  const allowedChanges = usePlannerStore(selectTeamPlanAllowedChanges);
  const forgeFloor = usePlannerStore(selectForgeFloor);
  const targetPhase = usePlannerStore(selectTeamPlanTargetPhase);
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

  const rows: [string, string][] = [
    [t.teamPlanObjectiveLabel, t[OBJECTIVE_KEY[objective]]],
    [t.teamPlanAllowedChangesLabel, t[ALLOWED_CHANGES_KEY[allowedChanges]]],
    [t.homeCardOptimizerScope, sub(t.homeCardOptimizerScopeValue, { count: scopeCount, total: heroes.length })],
    [t.teamPlanForgeFloorLabel, `+${forgeFloor}`],
    [t.teamPlanPhaseLabel, targetPhase == null ? t.homeCardOptimizerPhaseAuto : formatPhaseLabel(targetPhase, lang)],
  ];

  return (
    <HomeSectionCard
      section="optimizer"
      state={inputsUsable ? 'ready' : 'needs'}
      context={t.homeCardOptimizerContext}
      footer={inputsUsable ? t.homeCardOptimizerReady : needsLine}
    >
      <HomeKeyValues rows={rows} testId="home-optimizer" />
    </HomeSectionCard>
  );
}
