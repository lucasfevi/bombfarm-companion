'use client';

/**
 * The "Apply this plan" panel — reads the settled plan, the live account, the forge queue and the
 * apply store; builds the facts every row and confirm needs; and composes the ledger strip, the
 * three rows (the forge row through `forgeRow`'s seam, contract item 1), the confirms and the
 * blocking modal. This file is the one place that turns a step's confirm press into
 * `applyActions.confirm(step, units, request)` — every row and confirm below it is a pure read.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AccountSource, ApplyEquipUnit, ApplyPointsUnit, ApplyStartRequest, ApplyStep } from '@bombfarm/contracts';
import { derivePointsUnits, deriveEquipUnits } from '@bombfarm/domain/team-plan';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { TeamPlan, ForgeAction } from '@bombfarm/domain/team-plan/types';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { useForgeQueue } from '../../lib/forge/forge-queue-store';
import type { ForgeQueueState } from '../../lib/forge/forge-queue-reducer';
import { applyActions, useApplyProgress } from '../../lib/optimizer/apply-store';
import { buildApplyFacts, nextUndoneStep, stepGate, walletShortHeroes } from '../../lib/optimizer/apply-panel-model';
import { buildOptimizerInputs } from '../../lib/optimizer/optimizer-inputs';
import type { RowSkipReason } from '../../lib/optimizer/apply-labels';
import type { StepRecord } from '../../lib/optimizer/apply-progress-reducer';
import type { ForgeLabels } from '../forge/forge-labels';
import { ApplyLedgerStrip } from './apply-ledger-strip';
import { ApplyEquipRow, ApplyPointsRow } from './apply-step-row';
import { ApplyEquipConfirm, ApplyPointsConfirm, type ApplyPointsConfirmHero } from './apply-confirms';
import { ApplyModal } from './apply-modal';

const NO_HEROES: readonly HeroRecord[] = [];

/**
 * The forge row's mount contract (spec § *Contract with the forge row*, item 1) — defined here
 * since this item ships it and `forge-queue-batch-add` mounts against it in the same PR; not yet
 * exported anywhere else in the tree.
 */
export type ApplyForgeRowProps = {
  readonly forgeList: readonly ForgeAction[];
  readonly planRunId: string;
  readonly queue: ForgeQueueState;
  readonly gear: readonly InventoryViewItem[];
  readonly labels: ForgeLabels;
  readonly gate: null | { readonly reason: string };
  readonly record: StepRecord | undefined;
  readonly onDone: (result: { made: number; skipped: number }) => void;
};

/** The pending units, verbatim — a plain filter over the domain's own derived units, so the
 *  request `applyActions.confirm` hands the store is never a relabelled or reshaped copy. Pulled
 *  out of the component so it is directly testable without a click event this test project has no
 *  way to fire (node-env `renderToStaticMarkup`, no jsdom). */
export function buildEquipStartRequest(
  planRunId: string,
  equipUnits: readonly ApplyEquipUnit[],
  pendingIndexes: ReadonlySet<number>,
): ApplyStartRequest {
  return { step: 'equip', planRunId, units: equipUnits.filter((unit) => pendingIndexes.has(unit.index)) };
}

export function buildPointsStartRequest(
  planRunId: string,
  pointsUnits: readonly ApplyPointsUnit[],
  pendingIndexes: ReadonlySet<number>,
): ApplyStartRequest {
  return { step: 'points', planRunId, units: pointsUnits.filter((unit) => pendingIndexes.has(unit.index)) };
}

export function ApplyPanel({
  plan,
  planHeroes,
  planRunId,
  isStale,
  farmChosenPhase,
  forgeWritesEnabled,
  accountSource,
  forgeRow,
}: {
  plan: TeamPlan;
  planHeroes: readonly HeroRecord[] | null;
  planRunId: string;
  isStale: boolean;
  farmChosenPhase: number | null;
  forgeWritesEnabled: boolean;
  accountSource: AccountSource | null;
  /** The forge row's own component, mounted through this seam (spec § *Contract with the forge
   *  row*, item 1) — absent in this item; `forge-queue-batch-add` passes it in the same PR. */
  forgeRow?: (props: ApplyForgeRowProps) => ReactNode;
}) {
  const t = useCopy();
  const { locale } = useLocale();
  const account = useAccountView();
  const queue = useForgeQueue();
  const progress = useApplyProgress();

  useEffect(() => {
    applyActions.bind(planRunId);
  }, [planRunId]);

  const liveView = account.status === 'loaded' ? account.view : null;
  const accountLoaded = account.status === 'loaded';

  // Memoised on the live view's own reference — a live account tick that did not change the view
  // recomputes nothing here (design § `ApplyPanel`'s `useMemo` note).
  const facts = useMemo(
    () => buildApplyFacts({ plan, planHeroes, liveView, farmChosenPhase, t, locale }),
    [plan, planHeroes, liveView, farmChosenPhase, t, locale],
  );

  const equipUnits = useMemo(() => deriveEquipUnits(plan.moveList), [plan]);
  const pointsUnits = useMemo(() => derivePointsUnits(plan), [plan]);

  const liveHeroes = useMemo(() => {
    if (liveView === null) return new Map<string, HeroRecord>();
    const built = buildOptimizerInputs(liveView, farmChosenPhase);
    return built === null ? new Map<string, HeroRecord>() : new Map(built.inputs.heroes.map((hero) => [hero.id, hero]));
  }, [liveView, farmChosenPhase]);

  const walletShort = useMemo(
    () => walletShortHeroes(pointsUnits, facts.ledger.walletBefore, planHeroes ?? NO_HEROES, liveHeroes),
    [pointsUnits, facts.ledger.walletBefore, planHeroes, liveHeroes],
  );

  const pointsSkipByIndex = useMemo(() => {
    const map = new Map<number, RowSkipReason>();
    if (facts.steps.points.kind === 'units') {
      for (const skip of facts.steps.points.skips) map.set(skip.index, skip.reason);
    }
    return map;
  }, [facts.steps.points]);

  const pointsConfirmHeroes = useMemo<ApplyPointsConfirmHero[]>(() => {
    const units = facts.steps.points.kind === 'units' ? facts.steps.points.units : [];
    return pointsUnits.map((unit, index) => ({
      index: unit.index,
      name: units[index]?.subject ?? unit.heroId,
      level: unit.level,
      needsRespec: unit.needsRespec,
      points: unit.pointsPlaced,
      gold: unit.respecGold,
      skipReason: pointsSkipByIndex.get(unit.index) ?? null,
    }));
  }, [pointsUnits, facts.steps.points, pointsSkipByIndex]);

  const runningStep: ApplyStep | null =
    progress.steps.equip.status === 'running' ? 'equip' : progress.steps.points.status === 'running' ? 'points' : null;
  const anyStepApplied =
    progress.steps.equip.status === 'done' ||
    progress.steps.equip.status === 'stopped' ||
    progress.steps.points.status === 'done' ||
    progress.steps.points.status === 'stopped' ||
    progress.steps.forge.status === 'done';

  const queueRunning = queue.status === 'running';

  const equipGate = !accountLoaded
    ? ({ enabled: false, reason: 'loading' } as const)
    : stepGate(facts.steps.equip, 'equip', { forgeWritesEnabled, isStale, anyStepApplied, running: runningStep, queueRunning });
  const pointsGate = !accountLoaded
    ? ({ enabled: false, reason: 'loading' } as const)
    : stepGate(facts.steps.points, 'points', { forgeWritesEnabled, isStale, anyStepApplied, running: runningStep, queueRunning });

  // The forge row's own gate (contract item 4): only "another step running" and "stale before any
  // step applied" reach it — never the writes switch or the account source, since the row writes
  // nothing itself.
  const forgeGate: { reason: string } | null =
    runningStep !== null
      ? { reason: sub(t.applyPanelOtherRunning, { step: runningStep === 'equip' ? t.applyStepEquipTitle : t.applyStepPointsTitle }) }
      : isStale && !anyStepApplied
        ? { reason: t.applyPanelStale }
        : null;

  const otherStepTitle = runningStep === null ? null : runningStep === 'equip' ? t.applyStepEquipTitle : t.applyStepPointsTitle;

  const banner =
    runningStep !== null
      ? sub(t.applyPanelOtherRunning, { step: otherStepTitle ?? '' })
      : !forgeWritesEnabled
        ? sub(t.applyPanelSwitchOff, { switch: t.settingsForgeWritesLabel })
        : isStale && !anyStepApplied
          ? t.applyPanelStale
          : null;

  const [confirmQueueRunning, setConfirmQueueRunning] = useState(false);

  function openEquipConfirm(): void {
    setConfirmQueueRunning(queueRunning);
    applyActions.openConfirm('equip');
  }
  function openPointsConfirm(): void {
    setConfirmQueueRunning(queueRunning);
    applyActions.openConfirm('points');
  }

  function confirmEquip(): void {
    const pendingSet = facts.steps.equip.kind === 'units' ? new Set(facts.steps.equip.pending) : new Set<number>();
    const request = buildEquipStartRequest(planRunId, equipUnits, pendingSet);
    const labels = facts.steps.equip.kind === 'units' ? facts.steps.equip.units.filter((u) => pendingSet.has(u.index)) : [];
    applyActions.confirm('equip', labels, request);
  }

  function confirmPoints(): void {
    const pendingSet = facts.steps.points.kind === 'units' ? new Set(facts.steps.points.pending) : new Set<number>();
    const request = buildPointsStartRequest(planRunId, pointsUnits, pendingSet);
    const labels = facts.steps.points.kind === 'units' ? facts.steps.points.units.filter((u) => pendingSet.has(u.index)) : [];
    applyActions.confirm('points', labels, request);
  }

  const hasNext = nextUndoneStep(progress.steps, progress.modal?.step ?? null) !== null;

  return (
    <div
      data-testid="apply-panel"
      data-account-source={accountSource ?? undefined}
      className="flex flex-col gap-3 border-t border-line pt-3"
    >
      <div>
        <h2 className="m-0 text-sm font-bold tracking-wide text-ink uppercase">{t.applyPanelTitle}</h2>
        <p className="m-0 mt-1 text-[13px] text-muted">{t.applyPanelIntro}</p>
      </div>

      {banner !== null ? (
        <p data-testid="apply-panel-banner" className="m-0 text-[13px] text-warn" role="status">
          {banner}
        </p>
      ) : null}

      <ApplyLedgerStrip ledger={facts.ledger} />

      <div className="flex flex-col">
        <ApplyEquipRow
          t={t}
          facts={facts.steps.equip}
          gate={equipGate}
          record={progress.steps.equip}
          otherStepTitle={otherStepTitle}
          onPress={openEquipConfirm}
        />

        {forgeRow !== undefined
          ? forgeRow({
              forgeList: facts.forgeRow.forgeList,
              planRunId,
              queue,
              gear: facts.forgeRow.gear,
              labels: facts.forgeRow.labels,
              gate: forgeGate,
              record: progress.steps.forge,
              onDone: applyActions.forgeDone,
            })
          : null}

        <ApplyPointsRow
          t={t}
          facts={facts.steps.points}
          gate={pointsGate}
          record={progress.steps.points}
          otherStepTitle={otherStepTitle}
          onPress={openPointsConfirm}
          walletShort={walletShort}
        />
      </div>

      <ApplyEquipConfirm
        open={progress.confirming === 'equip'}
        pendingCount={facts.steps.equip.kind === 'units' ? facts.steps.equip.pending.length : 0}
        queueRunning={confirmQueueRunning}
        onConfirm={confirmEquip}
        onOpenChange={(open) => {
          if (!open) applyActions.cancelConfirm();
        }}
      />
      <ApplyPointsConfirm
        open={progress.confirming === 'points'}
        heroes={pointsConfirmHeroes}
        queueRunning={confirmQueueRunning}
        onConfirm={confirmPoints}
        onOpenChange={(open) => {
          if (!open) applyActions.cancelConfirm();
        }}
      />

      <ApplyModal
        modal={progress.modal}
        queuePaused={progress.queuePausedByApply}
        onStop={applyActions.stop}
        onClose={applyActions.closeModal}
        onContinue={applyActions.continueNext}
        hasNext={hasNext}
      />
    </div>
  );
}
