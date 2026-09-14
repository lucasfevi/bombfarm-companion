'use client';

/**
 * The forge queue in the shell's status bar: how many pieces wait, the one rolling and how far it
 * has come, why the queue halted, and Start and Cancel. Drawn from the shell rather than from a
 * tab so the queue is in sight and in reach on every screen — the piece rolling is main's, and
 * only the Forge tab draws its rail. Nothing at all while the queue is empty.
 *
 * The queue's gold is the player's, so Start asks first, the way the Forge button asks twice.
 * The same gate applies before the question: an account with no server behind it and the forge
 * writes switch each say why the queue cannot start, in the same words the Forge tab uses.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AccountSource } from '@bombfarm/contracts';
import { buildInventoryView } from '@bombfarm/domain/inventory-view';
import { ActionChip, ConfirmDialog, cn } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { cancelForgeQueue, startForgeQueue, syncForgeQueue, useForgeQueue } from '../../lib/forge/forge-queue-store';
import { bagUpgrades, forgeQueueExpectedGold, resolveForgeQueue } from '../../lib/forge/forge-queue-view';
import { gearOf } from '../../lib/forge/forge-rows';
import { dispatchForgeRun, useForgeRun } from '../../lib/forge/forge-run-store';
import {
  forgeButtonReason,
  forgeLabels,
  forgeLevel,
  forgeReasonText,
  forgeStartRefusalText,
  forgeStopText,
} from './forge-labels';

const NO_GEAR: never[] = [];

export function ForgeQueueStatus({
  forgeWritesEnabled,
  accountSource,
}: {
  forgeWritesEnabled: boolean;
  accountSource: AccountSource | null;
}) {
  const t = useCopy();
  const { lang, locale } = useLocale();
  const queue = useForgeQueue();
  const run = useForgeRun();
  const account = useAccountView();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const shown = queue.pieces.length > 0 || queue.active !== null;
  const items = shown && account.status === 'loaded' ? account.view.payload.items : undefined;
  const gear = useMemo(() => (items === undefined ? NO_GEAR : gearOf(buildInventoryView(items).items)), [items]);
  const labels = useMemo(() => forgeLabels(t, lang, locale), [t, lang, locale]);

  useEffect(() => {
    if (items === undefined) return;
    syncForgeQueue(bagUpgrades(gear));
  }, [items, gear]);

  const rows = useMemo(() => resolveForgeQueue(queue.pieces, gear), [queue.pieces, gear]);
  const expectedGold = useMemo(() => forgeQueueExpectedGold(rows), [rows]);

  const onStart = useCallback(() => {
    startForgeQueue();
  }, []);
  const queueRunId = queue.active?.runId ?? null;
  const inFlight = queueRunId !== null && run.status === 'running' && run.run.runId === queueRunId ? run.run : null;
  const onCancel = useCallback(() => {
    if (inFlight !== null) dispatchForgeRun({ kind: 'cancel' });
    cancelForgeQueue();
  }, [inFlight]);
  const openConfirm = useCallback(() => {
    setConfirmOpen(true);
  }, []);

  if (!shown) return null;

  const running = queue.status === 'running';
  const head = rows[0] ?? null;
  const headName = head === null ? '' : head.item === null ? head.piece.itemId : labels.itemName(head.item);
  const waiting = queue.pieces.length - (queue.active === null ? 0 : 1);

  const reason = forgeButtonReason({ upgrade: 0, accountSource, forgeWritesEnabled, running: false, cancelRequested: false });
  const canStart = reason === 'ready' && !running && queue.pieces.length > 0;

  const haltText =
    queue.halt === null
      ? null
      : queue.halt.kind === 'stop'
        ? forgeStopText(queue.halt.stop, t)
        : forgeStartRefusalText(queue.halt.reason, t);

  const confirmBody =
    expectedGold === null
      ? t.forgeQueueConfirmNoEstimate
      : rows.length === 1
        ? sub(t.forgeQueueConfirmOne, { item: headName, target: forgeLevel(head?.piece.target ?? 0), gold: labels.gold(Math.round(expectedGold)) })
        : sub(t.forgeQueueConfirmMany, { count: rows.length, gold: labels.gold(Math.round(expectedGold)) });

  return (
    <div data-testid="forge-queue-status" data-status={queue.status} className="flex min-w-0 items-center gap-2">
      <span className="font-semibold text-ink">{t.forgeQueueTitle}</span>
      {waiting > 0 || queue.active === null ? (
        <span data-testid="forge-queue-waiting" className="text-muted">
          {sub(t.forgeQueueWaiting, { count: waiting })}
        </span>
      ) : null}
      {queue.active !== null && head !== null ? (
        <span data-testid="forge-queue-in-flight" className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate text-ink">{headName}</span>
          <span className="font-mono tabular-nums text-ink">
            {forgeLevel(inFlight?.upgrade ?? head.item?.upgrade ?? 0)} → {forgeLevel(head.piece.target)}
          </span>
          <span className="text-muted">
            {inFlight === null
              ? t.forgeQueueRolling
              : sub(t.forgeQueueProgress, { rolls: labels.count(inFlight.tally.rolls), spent: labels.gold(inFlight.tally.spent) })}
          </span>
        </span>
      ) : null}
      {haltText !== null ? (
        <span data-testid="forge-queue-halt" className="text-warn">
          {sub(t.forgeQueueStopped, { reason: haltText })}
        </span>
      ) : null}
      {!running && reason !== 'ready' ? (
        <span data-testid="forge-queue-reason" className="text-muted">
          {forgeReasonText(reason, t)}
        </span>
      ) : null}
      {running ? (
        <ActionChip
          tone="warn"
          label={t.forgeQueueCancel}
          data-testid="forge-queue-cancel"
          onClick={onCancel}
        />
      ) : (
        <ActionChip
          tone={canStart ? 'active' : 'muted'}
          label={queue.status === 'halted' ? t.forgeQueueResume : t.forgeQueueStart}
          data-testid="forge-queue-start"
          disabled={!canStart}
          className={cn(!canStart && 'cursor-not-allowed', !canStart && 'opacity-60')}
          onClick={canStart ? openConfirm : undefined}
        />
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.forgeQueueConfirmTitle}
        description={confirmBody}
        confirmLabel={t.forgeQueueConfirm}
        cancelLabel={t.forgeQueueConfirmCancel}
        onConfirm={onStart}
      />
    </div>
  );
}
