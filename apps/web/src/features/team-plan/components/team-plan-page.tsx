'use client';

import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { TeamPlanScreenView } from '@bombfarm/team-plan/components';
import type { TeamPlanResultSort } from '@bombfarm/team-plan/model';
import { useTeamPlanSolver } from '@/shared/hooks/use-team-plan-solver';
import type { Lang, Strings } from '@/shared/i18n';
import {
  usePlannerStore,
  selectTeamPlanIsStale,
} from '@/shared/stores';
import {
  selectTeamPlanControls,
  selectTeamPlanInputs,
} from '@/shared/stores/selectors/team-plan-selectors';
import { loadTeamPlanResultSort, saveTeamPlanResultSort } from '@/shared/lib/team-plan-storage';
import { webTeamPlanEmptyState } from './team-plan-empty-states';

/**
 * This app's connector for the shared screen. Every store read the screen needs happens here and
 * nowhere below: `@bombfarm/team-plan/components` is prop-driven so the desktop app can render the
 * identical screen from its own state.
 */
export function TeamPlanPage({
  t,
  lang,
  onImport,
}: {
  t: Strings;
  lang: Lang;
  onImport: () => void;
}) {
  const inputs = usePlannerStore(useShallow(selectTeamPlanInputs));
  const controls = usePlannerStore(useShallow(selectTeamPlanControls));
  const plan = usePlannerStore((state) => state.plan);
  const planHeroes = usePlannerStore((state) => state.planHeroes);
  const planBasis = usePlannerStore((state) => state.planBasis);
  const runStatus = usePlannerStore((state) => state.runStatus);
  const runId = usePlannerStore((state) => state.runId);
  const isStale = usePlannerStore(selectTeamPlanIsStale);
  const openHeroIds = usePlannerStore((state) => state.openHeroIds);

  const setScope = usePlannerStore((state) => state.setScope);
  const setForgeFloor = usePlannerStore((state) => state.setForgeFloor);
  const setObjective = usePlannerStore((state) => state.setObjective);
  const setAllowedChanges = usePlannerStore((state) => state.setAllowedChanges);
  const setIgnoreFieldCrowding = usePlannerStore((state) => state.setIgnoreFieldCrowding);
  const setTargetPhase = usePlannerStore((state) => state.setTargetPhase);
  const setGatePhase = usePlannerStore((state) => state.setGatePhase);
  const startRun = usePlannerStore((state) => state.startRun);
  const resolveRun = usePlannerStore((state) => state.resolveRun);
  const applyPlan = usePlannerStore((state) => state.applyPlan);
  const clearPlan = usePlannerStore((state) => state.clearPlan);
  const setOpenHeroIds = usePlannerStore((state) => state.setOpenHeroIds);
  const { runner } = useTeamPlanSolver();

  // Read during the first render: the shell's mount gate means this page never renders on the
  // server, so there is no prerendered markup for the stored order to disagree with.
  const [resultSort, setResultSort] = useState<TeamPlanResultSort>(loadTeamPlanResultSort);
  useEffect(() => {
    saveTeamPlanResultSort(resultSort);
  }, [resultSort]);

  return (
    <TeamPlanScreenView
      t={t}
      lang={lang}
      runner={runner}
      data={{ inputs, controls, plan, planHeroes, planBasis, runStatus, runId, isStale, openHeroIds, resultSort }}
      actions={{
        setScope,
        setForgeFloor,
        setObjective,
        setAllowedChanges,
        setIgnoreFieldCrowding,
        setTargetPhase,
        setGatePhase,
        startRun,
        resolveRun,
        applyPlan,
        clearPlan,
        setOpenHeroIds,
        setResultSort,
      }}
      slots={{ emptyState: (kind) => webTeamPlanEmptyState(kind, t, onImport) }}
    />
  );
}
