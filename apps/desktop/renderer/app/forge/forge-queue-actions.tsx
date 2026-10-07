'use client';

/**
 * Start and Cancel for the forge queue, with why it halted and why it cannot start — drawn once
 * in the band under the top bar and again on the Forge tab's queue panel, so the queue can be
 * run from either. The queue's gold is the player's, so Start asks first, the way the Forge
 * button asks twice, and the dialog prints what everything queued should cost. The same gate
 * applies before the question: an account with no server behind it and the forge writes switch
 * each say why the queue cannot start, in the same words the Forge tab uses.
 */
import { useCallback, useState } from 'react';
import type { AccountSource } from '@bombfarm/contracts';
import { Button, ConfirmDialog, cn } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { isBurning } from '../../lib/deconstruct/deconstruct-run-reducer';
import { useDeconstructRun } from '../../lib/deconstruct/deconstruct-run-store';
import type { ForgeQueueState } from '../../lib/forge/forge-queue-reducer';
import { cancelForgeQueue, clearForgeQueue, startForgeQueue } from '../../lib/forge/forge-queue-store';
import type { ForgeQueueSettings } from '../../lib/forge/forge-queue-settings';
import type { ForgeQueuePricing, ForgeQueueRow } from '../../lib/forge/forge-queue-view';
import { dispatchForgeRun, useForgeRun } from '../../lib/forge/forge-run-store';
import { ForgeQueueConfirmBody } from './forge-queue-confirm-body';
import {
  forgeButtonReason,
  forgeReasonText,
  forgeStartRefusalText,
  forgeStopText,
  type ForgeLabels,
} from './forge-labels';

export function ForgeQueueActions({
  queue,
  rows,
  pricing,
  settings,
  labels,
  forgeWritesEnabled,
  accountSource,
  layout = 'inline',
}: {
  queue: ForgeQueueState;
  rows: readonly ForgeQueueRow[];
  pricing: ForgeQueuePricing;
  settings: ForgeQueueSettings;
  labels: ForgeLabels;
  forgeWritesEnabled: boolean;
  accountSource: AccountSource | null;
  /** `inline` is the band's row; `stacked` is the panel's column, its button as wide as the
   *  Forge button above it. */
  layout?: 'inline' | 'stacked';
}) {
  const t = useCopy();
  const run = useForgeRun();
  const burning = isBurning(useDeconstructRun());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const queueRunId = queue.active?.runId ?? null;
  const queueRunOnRail = queueRunId !== null && run.status === 'running' && run.run.runId === queueRunId;
  const onCancel = useCallback(() => {
    if (queueRunOnRail) dispatchForgeRun({ kind: 'cancel' });
    cancelForgeQueue();
  }, [queueRunOnRail]);
  const openConfirm = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  const running = queue.status === 'running';
  // A paused queue holds the same Cancel-only footing as a running one — it is standing aside for
  // the Optimizer's apply step, not stopped, and Start would contend with that step over the one
  // write gate.
  const holds = running || queue.status === 'paused';
  const reason = forgeButtonReason({ upgrade: 0, accountSource, forgeWritesEnabled, running: false, cancelRequested: false });
  const canStart = reason === 'ready' && !holds && !burning && queue.pieces.length > 0;

  const haltText =
    queue.halt === null
      ? null
      : queue.halt.kind === 'stop'
        ? forgeStopText(queue.halt.stop, t)
        : forgeStartRefusalText(queue.halt.reason, t);

  const stacked = layout === 'stacked';
  const buttonClass = cn(stacked && 'w-full');
  const waiting = queue.pieces.length - (queue.active === null ? 0 : 1);

  return (
    <div
      data-testid="forge-queue-actions"
      className={cn('flex', 'min-w-0', 'gap-2', stacked ? 'flex-col' : 'flex-wrap', stacked ? 'items-stretch' : 'items-center')}
    >
      {haltText !== null ? (
        <span data-testid="forge-queue-halt" className="text-[11px] text-warn">
          {sub(t.forgeQueueStopped, { reason: haltText })}
        </span>
      ) : null}
      {!holds && reason !== 'ready' ? (
        <span data-testid="forge-queue-reason" className="text-[11px] text-muted">
          {forgeReasonText(reason, t)}
        </span>
      ) : null}
      {!holds && reason === 'ready' && burning ? (
        <span data-testid="forge-queue-reason" className="text-[11px] text-muted">
          {t.deconstructReasonRunning}
        </span>
      ) : null}
      {holds ? (
        <Button type="button" variant="default" className={buttonClass} data-testid="forge-queue-cancel" onClick={onCancel}>
          {t.forgeQueueCancel}
        </Button>
      ) : (
        <Button type="button" variant="primary" className={buttonClass} data-testid="forge-queue-start" disabled={!canStart} onClick={openConfirm}>
          {queue.status === 'halted' ? t.forgeQueueResume : t.forgeQueueStart}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        className={buttonClass}
        aria-label={t.forgeQueueClearAria}
        data-testid="forge-queue-clear"
        disabled={waiting === 0}
        onClick={clearForgeQueue}
      >
        {t.forgeQueueClear}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.forgeQueueConfirmTitle}
        description={<ForgeQueueConfirmBody rows={rows} pricing={pricing} settings={settings} labels={labels} />}
        confirmLabel={t.forgeQueueConfirm}
        cancelLabel={t.forgeQueueConfirmCancel}
        closeLabel={t.confirmDialogClose}
        onConfirm={startForgeQueue}
      />
    </div>
  );
}
