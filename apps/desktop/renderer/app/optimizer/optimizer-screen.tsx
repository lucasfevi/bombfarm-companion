'use client';

/**
 * The settled snapshot, drawn through the shared package — split out of `optimizer-view.tsx` so
 * every derivation below runs against a non-null snapshot rather than being written twice for the
 * early-return ladder's benefit, the same reason `FarmScreen` is split out of `FarmView`.
 */
import { useCallback, useMemo, useRef } from 'react';
import {
  SetupAuraCapField,
  TeamPlanScreenView,
  TeamPlanEmptyPanel,
  type ForgeQueueEntryRef,
  type TeamPlanScreenActions,
  type TeamPlanScreenData,
  type TeamPlanScreenSlots,
} from '@bombfarm/team-plan/components';
import {
  applyTeamPlanControlChange,
  computeTeamPlanInputSignature,
  isTeamPlanStale,
  mergeScopeForRoster,
  type PlanBasis,
  type ScopeState,
  type TeamPlanControlChange,
} from '@bombfarm/team-plan/core';
import type { TeamPlanEmptyStateKind } from '@bombfarm/team-plan/model';
import type { TeamPlanRunnerHandle, TeamPlanRunStatus } from '@bombfarm/team-plan/runner';
import type { AccountSource } from '@bombfarm/contracts';
import type { TeamPlan, TeamPlanAllowedChanges, TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { TeamAuraId } from '@bombfarm/domain/team-buffs';
import { itemName } from '@bombfarm/domain/game-labels';
import { useCopy, useLocale } from '../../lib/copy';
import type { OptimizerSettledSnapshot } from '../../lib/optimizer/optimizer-snapshot-store';
import type { OptimizerPlanState } from '../../lib/optimizer/optimizer-plan-store';
import type { OptimizerView } from '../../lib/optimizer/optimizer-view-storage';
import { optimizerScreenCopy, useTeamPlanCopy } from '../screen-copy';
import { ForgeQueueAdd } from '../forge/forge-queue-add';
import { ApplyPanel } from './apply-panel';
import { ApplyForgeRow } from './apply-forge-row';

type OptimizerScreenActionsIn = {
  startRun: (runId: string, signature: string, heroes: readonly HeroRecord[], basis: PlanBasis) => void;
  resolveRun: (runId: string, status: Exclude<TeamPlanRunStatus, 'running'>) => void;
  applyPlan: (runId: string, plan: TeamPlan) => void;
  clearPlan: () => void;
  openHeroes: (heroIds: readonly string[]) => void;
};

export function OptimizerScreen({
  snapshot,
  controls,
  setControls,
  planState,
  runner,
  actions,
  forgeWritesEnabled,
  accountSource,
}: {
  snapshot: OptimizerSettledSnapshot;
  controls: OptimizerView;
  setControls: (next: OptimizerView) => void;
  planState: OptimizerPlanState;
  runner: TeamPlanRunnerHandle;
  actions: OptimizerScreenActionsIn;
  forgeWritesEnabled: boolean;
  accountSource: AccountSource | null;
}) {
  const t = useCopy();
  const { lang } = useLocale();
  const teamPlanCopy = useTeamPlanCopy();
  const screenCopy = useMemo(() => optimizerScreenCopy(teamPlanCopy, t, lang), [teamPlanCopy, t, lang]);

  const { inputs } = snapshot;

  // The current controls, read through a ref so the single control handler and the actions bag
  // stay stable across a render that only changed the controls themselves.
  const controlsRef = useRef(controls);
  controlsRef.current = controls;

  const onControlChange = useCallback(
    (change: TeamPlanControlChange) => {
      const current = controlsRef.current;
      const result = applyTeamPlanControlChange(current, change, {
        heroes: inputs.heroes,
        farmChosenPhase: inputs.farmChosenPhase,
        phase: inputs.phase,
      });
      if (result === null) return;
      setControls(result.controls);
      if (result.clearsPlan) actions.clearPlan();
    },
    [inputs.heroes, inputs.farmChosenPhase, inputs.phase, setControls, actions],
  );

  const mergedControls = useMemo(
    () => ({ ...controls, scopeByHeroId: mergeScopeForRoster([...inputs.heroes], controls.scopeByHeroId) }),
    [controls, inputs.heroes],
  );

  const liveSignature = useMemo(
    () => computeTeamPlanInputSignature(inputs, mergedControls),
    [inputs, mergedControls],
  );
  const liveSignatureRef = useRef(liveSignature);
  liveSignatureRef.current = liveSignature;
  const heroesRef = useRef(inputs.heroes);
  heroesRef.current = inputs.heroes;
  // Frozen whole at startRun, the same way the heroes are: the ledger of what changed since the
  // plan is read against these, not against whatever the snapshot holds when the plan lands.
  const basisRef = useRef<PlanBasis>({ inputs, controls: mergedControls });
  basisRef.current = { inputs, controls: mergedControls };

  const isStale = isTeamPlanStale(planState.signature, liveSignature);

  const data = useMemo<TeamPlanScreenData>(
    () => ({
      inputs,
      controls: mergedControls,
      plan: planState.plan,
      planHeroes: planState.heroes,
      planBasis: planState.basis,
      runStatus: planState.runStatus,
      runId: planState.runId,
      isStale,
      openHeroIds: planState.openHeroIds,
    }),
    [
      inputs,
      mergedControls,
      planState.plan,
      planState.heroes,
      planState.basis,
      planState.runStatus,
      planState.runId,
      isStale,
      planState.openHeroIds,
    ],
  );

  const screenActions = useMemo<TeamPlanScreenActions>(
    () => ({
      setScope: (heroId: string, scope: ScopeState) => {
        onControlChange({ kind: 'scope', heroId, scope });
      },
      setForgeFloor: (value: number) => {
        onControlChange({ kind: 'forgeFloor', value });
      },
      setObjective: (value: TeamPlanObjective) => {
        onControlChange({ kind: 'objective', value });
      },
      setAllowedChanges: (value: TeamPlanAllowedChanges) => {
        onControlChange({ kind: 'allowedChanges', value });
      },
      setIgnoreFieldCrowding: (value: boolean) => {
        onControlChange({ kind: 'ignoreFieldCrowding', value });
      },
      setTargetPhase: (value: number | null) => {
        onControlChange({ kind: 'targetPhase', value });
      },
      startRun: (runId: string) => {
        actions.startRun(runId, liveSignatureRef.current, heroesRef.current, basisRef.current);
      },
      resolveRun: actions.resolveRun,
      applyPlan: actions.applyPlan,
      clearPlan: actions.clearPlan,
      setOpenHeroIds: actions.openHeroes,
    }),
    [onControlChange, actions],
  );

  const emptyTitleBody: Record<TeamPlanEmptyStateKind, [string, string]> = {
    noRoster: [t.optimizerEmptyNoRosterTitle, t.optimizerEmptyNoRosterBody],
    noInventory: [t.optimizerEmptyNoInventoryTitle, t.optimizerEmptyNoInventoryBody],
    allLeaveAlone: [t.optimizerEmptyAllLeaveAloneTitle, t.optimizerEmptyAllLeaveAloneBody],
  };

  const inventoryItems = inputs.inventory.items;
  const forgeQueueAction = useCallback(
    (entry: ForgeQueueEntryRef) => {
      const item = inventoryItems.find((candidate) => candidate.id === entry.itemId);
      const name = item === undefined ? entry.itemId : itemName(item, lang);
      return <ForgeQueueAdd itemId={entry.itemId} target={entry.to} itemName={name} />;
    },
    [inventoryItems, lang],
  );

  const aurasAtCap = controls.aurasAtCap;
  const setAuraAtCap = useCallback(
    (auraId: TeamAuraId, value: boolean) => {
      onControlChange({ kind: 'auraAtCap', auraId, value });
    },
    [onControlChange],
  );

  const slots = useMemo<TeamPlanScreenSlots>(
    () => ({
      forgeQueueAction,
      setupFields: (
        <SetupAuraCapField
          label={t.optimizerAurasAtCapLabel}
          hint={t.optimizerAurasAtCapHint}
          value={aurasAtCap}
          onToggle={setAuraAtCap}
          lang={lang}
          testId="optimizer-auras-at-cap"
        />
      ),
      emptyState: (kind: TeamPlanEmptyStateKind) => {
        const [title, body] = emptyTitleBody[kind];
        return <TeamPlanEmptyPanel title={title} body={body} />;
      },
      applyPanel:
        planState.plan === null ? undefined : (
          <ApplyPanel
            plan={planState.plan}
            planHeroes={planState.heroes}
            planRunId={planState.runId ?? ''}
            isStale={isStale}
            farmChosenPhase={inputs.farmChosenPhase}
            forgeWritesEnabled={forgeWritesEnabled}
            accountSource={accountSource}
            forgeRow={(rowProps) => <ApplyForgeRow {...rowProps} />}
          />
        ),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emptyTitleBody is derived from t each render
    [
      t,
      lang,
      forgeQueueAction,
      aurasAtCap,
      setAuraAtCap,
      planState.plan,
      planState.heroes,
      planState.runId,
      isStale,
      inputs.farmChosenPhase,
      forgeWritesEnabled,
      accountSource,
    ],
  );

  return <TeamPlanScreenView t={screenCopy} lang={lang} data={data} actions={screenActions} slots={slots} runner={runner} />;
}
