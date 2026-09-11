'use client';

import { useShallow } from 'zustand/react/shallow';
import { TeamPlanScreenView } from '@bombfarm/team-plan/components';
import type { Lang, Strings } from '@/shared/i18n';
import {
  usePlannerStore,
  selectTeamPlanIsStale,
} from '@/shared/stores';
import {
  selectTeamPlanControls,
  selectTeamPlanInputs,
} from '@/shared/stores/selectors/team-plan-selectors';
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
  const runStatus = usePlannerStore((state) => state.runStatus);
  const runId = usePlannerStore((state) => state.runId);
  const isStale = usePlannerStore(selectTeamPlanIsStale);

  const setScope = usePlannerStore((state) => state.setScope);
  const setForgeFloor = usePlannerStore((state) => state.setForgeFloor);
  const setObjective = usePlannerStore((state) => state.setObjective);
  const setAllowedChanges = usePlannerStore((state) => state.setAllowedChanges);
  const setIgnoreFieldCrowding = usePlannerStore((state) => state.setIgnoreFieldCrowding);
  const setTargetPhase = usePlannerStore((state) => state.setTargetPhase);
  const startRun = usePlannerStore((state) => state.startRun);
  const resolveRun = usePlannerStore((state) => state.resolveRun);
  const applyPlan = usePlannerStore((state) => state.applyPlan);
  const clearPlan = usePlannerStore((state) => state.clearPlan);

  return (
    <TeamPlanScreenView
      t={t}
      lang={lang}
      data={{ inputs, controls, plan, runStatus, runId, isStale }}
      actions={{
        setScope,
        setForgeFloor,
        setObjective,
        setAllowedChanges,
        setIgnoreFieldCrowding,
        setTargetPhase,
        startRun,
        resolveRun,
        applyPlan,
        clearPlan,
      }}
      slots={{ emptyState: (kind) => webTeamPlanEmptyState(kind, t, onImport) }}
    />
  );
}
