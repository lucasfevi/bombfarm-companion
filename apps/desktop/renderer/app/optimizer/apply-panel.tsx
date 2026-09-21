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
import { cn } from '@bombfarm/ui';
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
import { ApplyEquipConfirm } from './apply-confirms';
import { ApplyPointsConfirm, type ApplyPointsConfirmHero } from './apply-points-confirm';
import { ApplyModal } from './apply-modal';

const NO_HEROES: readonly HeroRecord[] = [];

/**
 * The forge row's mount contract — the fixed prop shape a forge-row component receives through
 * the `forgeRow` seam below. Defined here since this panel ships the seam first; the row itself
 * mounts against it from elsewhere in the same PR.
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
  /** True when the panel expects this row to be pressed next — see `ApplyStepRowProps.next`. */
  readonly next?: boolean;
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
  /** The forge row's own component, mounted through this seam — absent here; the feature that
   *  draws the forge row passes it in the same PR. */
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
  // recomputes nothing here.
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

  // Every hero the plan was solved from, in the plan's own order: the ones it resets carry
  // their unit, the rest are listed so the reader sees them left alone rather than missing.
  const pointsConfirmHeroes = useMemo<ApplyPointsConfirmHero[]>(() => {
    const units = facts.steps.points.kind === 'units' ? facts.steps.points.units : [];
    const unitByHero = new Map(pointsUnits.map((unit, position) => [unit.heroId, { unit, position }]));
    const heroById = new Map((planHeroes ?? NO_HEROES).map((hero) => [hero.id, hero]));
    const rows: ApplyPointsConfirmHero[] = plan.perHero.map((row) => {
      const hero = heroById.get(row.heroId);
      const found = unitByHero.get(row.heroId);
      if (found === undefined) {
        return { index: null, hero, name: hero?.name ?? row.heroName, needsRespec: false, points: 0, gold: 0, skipReason: null };
      }
      return {
        index: found.unit.index,
        hero,
        name: units[found.position]?.subject ?? hero?.name ?? row.heroName,
        needsRespec: found.unit.needsRespec,
        points: found.unit.pointsPlaced,
        gold: found.unit.respecGold,
        skipReason: pointsSkipByIndex.get(found.unit.index) ?? null,
      };
    });
    return rows;
  }, [plan.perHero, planHeroes, pointsUnits, facts.steps.points, pointsSkipByIndex]);

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

  function confirmPoints(selected: ReadonlySet<number>): void {
    const pending = facts.steps.points.kind === 'units' ? facts.steps.points.pending : [];
    const pendingSet = new Set(pending.filter((index) => selected.has(index)));
    const request = buildPointsStartRequest(planRunId, pointsUnits, pendingSet);
    const labels = facts.steps.points.kind === 'units' ? facts.steps.points.units.filter((u) => pendingSet.has(u.index)) : [];
    applyActions.confirm('points', labels, request);
  }

  const hasNext = nextUndoneStep(progress.steps, progress.modal?.step ?? null) !== null;
  const nextStep = runningStep === null ? nextUndoneStep(progress.steps, null) : null;
  const doneCount = (['equip', 'forge', 'points'] as const).filter((step) => progress.steps[step].status === 'done').length;
  const stateLabel =
    doneCount === 0 ? t.applyPanelStateNone : doneCount === 3 ? t.applyPanelStateAll : sub(t.applyPanelStateSome, { done: doneCount, total: 3 });

  return (
    <div
      data-testid="apply-panel"
      data-account-source={accountSource ?? undefined}
      className="flex flex-col gap-3 rounded-sm border border-[color-mix(in_oklch,var(--accent)_50%,var(--line))] bg-surface px-4 py-3.5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="m-0 flex items-center gap-2.5 text-[13px] font-bold tracking-wide text-ink uppercase">
          {t.applyPanelTitle}
          <span
            data-testid="apply-panel-state"
            className={cn(
              'rounded-full',
              'border',
              'px-2',
              'py-0.5',
              'text-[11px]',
              'font-semibold',
              'tracking-normal',
              'normal-case',
              doneCount === 0 ? 'border-accent/60' : 'border-up/60',
              doneCount === 0 ? 'text-accent' : 'text-up',
            )}
          >
            {stateLabel}
          </span>
        </h2>
        <p className="m-0 text-[12px] text-muted">{t.applyPanelIntro}</p>
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
          next={nextStep === 'equip'}
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
              next: nextStep === 'forge',
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
          next={nextStep === 'points'}
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
