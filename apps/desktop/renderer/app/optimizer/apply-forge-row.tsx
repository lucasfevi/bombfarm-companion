'use client';

/**
 * The Apply panel's second row — one press that puts every applicable plan forge on the queue in
 * one batch. It prices only what this press would add (`toAdd`), never the plan's whole forge
 * list: the ledger strip above already prices the full list for its own figure, and reusing the
 * queue's own pricing here keeps this row and the queue's own Start confirm agreeing on the same
 * pieces.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { sub, subNodes, useCopy, useLocale, type Copy } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { addManyToForgeQueue } from '../../lib/forge/forge-queue-store';
import { bagUpgrades, forgeQueueExpectedGold, resolveForgeQueue } from '../../lib/forge/forge-queue-view';
import { planForgeQueueBatch, type ForgeQueueBatch } from '../../lib/forge/forge-queue-batch';
import type { StepRecord } from '../../lib/optimizer/apply-progress-reducer';
import { applyActions, useApplyProgress } from '../../lib/optimizer/apply-store';
import { ForgeGold } from '../forge/forge-gold';
import { ApplyStepRow, type ApplyStepRowAction } from './apply-step-row';
import { ApplyForgeConfirm } from './apply-confirms';
import type { ApplyForgeRowProps } from './apply-panel';

export type ForgeRowState =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'exhausted' }
  | { readonly kind: 'done'; readonly count: number }
  | { readonly kind: 'ready' };

/** The row's state, from the batch alone plus whether a run already recorded a receipt — no
 *  hooks, so a static test pins every case directly. */
export function describeForgeRow(batch: ForgeQueueBatch, record: StepRecord | undefined): ForgeRowState {
  if (batch.total === 0) return { kind: 'nothing' };
  if (record?.status === 'done') return { kind: 'done', count: record.made };
  if (batch.adding > 0) return { kind: 'ready' };
  if (batch.queued > 0) return { kind: 'done', count: batch.queued };
  return { kind: 'exhausted' };
}

function forgeSkipReasons(batch: ForgeQueueBatch, t: Copy): string {
  const parts: string[] = [];
  if (batch.missing > 0) parts.push(sub(t.applySkipCounted, { n: batch.missing, reason: t.applySkipItemMissing }));
  if (batch.atTarget > 0) parts.push(sub(t.applySkipCounted, { n: batch.atTarget, reason: t.applySkipForgeAtTarget }));
  return parts.join(', ');
}

export function ApplyForgeRow({ forgeList, queue, gear, gate, record, onDone, next = false }: ApplyForgeRowProps) {
  const t = useCopy();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  // "Continue to next step" from another step's window lands here as the store's `confirming`;
  // the confirm is this row's own, so the store's mark is taken and cleared in one move.
  const confirming = useApplyProgress().confirming;
  useEffect(() => {
    if (confirming !== 'forge') return;
    setOpen(true);
    applyActions.cancelConfirm();
  }, [confirming]);
  const testId = 'apply-step-forge';

  const batch = useMemo(
    () => planForgeQueueBatch(forgeList.map((piece) => ({ itemId: piece.itemId, to: piece.to })), queue, bagUpgrades(gear)),
    [forgeList, queue, gear],
  );
  const expectedGold = useMemo(() => forgeQueueExpectedGold(resolveForgeQueue(batch.toAdd, gear)), [batch.toAdd, gear]);
  const state = describeForgeRow(batch, record);
  const skipCount = batch.missing + batch.atTarget;

  const factsLine =
    batch.total === 0
      ? t.applyStepNothing
      : expectedGold === null
        ? sub(t.applyStepForgeFactsNoEstimate, { pieces: batch.adding, queued: batch.queued })
        : subNodes(t.applyStepForgeFacts, {
            pieces: batch.adding,
            queued: batch.queued,
            gold: <ForgeGold>{formatCount(expectedGold, locale)}</ForgeGold>,
          });

  const notes: ReactNode[] = [];
  if (state.kind === 'ready' && batch.retargeted > 0) {
    notes.push(sub(t.applyStepForgeTargets, { count: batch.retargeted }));
  }
  if (skipCount > 0) {
    notes.push(
      <span key="skips" data-testid={`${testId}-skips`}>
        {sub(t.applyStepWillSkip, { count: skipCount, total: batch.total, reasons: forgeSkipReasons(batch, t) })}
      </span>,
    );
  }

  function handleConfirm(): void {
    if (batch.toAdd.length === 0) return;
    addManyToForgeQueue(batch.toAdd);
    onDone({ made: batch.adding + batch.queued, skipped: batch.missing + batch.atTarget });
  }

  function openConfirm(): void {
    setOpen(true);
  }

  const action: ApplyStepRowAction =
    state.kind === 'nothing'
      ? { nothing: t.applyStepNothing }
      : state.kind === 'exhausted'
        ? { nothing: t.applyStepNothingLeft }
        : state.kind === 'done'
          ? { done: sub(t.applyStepDoneForge, { count: state.count }) }
          : gate !== null
            ? { label: sub(t.applyConfirmForge, { count: batch.adding }), onPress: openConfirm, disabled: true, reason: gate.reason }
            : { label: sub(t.applyConfirmForge, { count: batch.adding }), onPress: openConfirm, disabled: false };

  return (
    <>
      <ApplyStepRow index={2} title={t.applyStepForgeTitle} facts={factsLine} notes={notes} action={action} testId={testId} next={next} />
      <ApplyForgeConfirm
        open={open}
        count={batch.adding}
        onConfirm={handleConfirm}
        onOpenChange={setOpen}
      />
    </>
  );
}
