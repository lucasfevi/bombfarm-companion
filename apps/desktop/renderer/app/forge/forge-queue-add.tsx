'use client';

/**
 * The control that puts a piece and a target on the forge queue — on each entry of an Optimizer
 * hero's forge queue, and under the Forge button on the plan panel. One press queues it and the
 * button then says so; pressing it again changes nothing, since the queue keeps one entry per
 * piece, so it reads as a state, not a toggle. It spends nothing itself: the footer's Start is
 * where the gold question is asked.
 *
 * The bag is the truth about where the piece stands now, so the button reads it directly: a piece
 * the live bag already holds at or past the target says "Forged" and takes no press. The Optimizer
 * draws its plan from a pinned snapshot, so without this a piece the queue has just finished came
 * back as "Add to queue" — and a press re-queued it only for the next account read to drop it.
 */
import { useCallback } from 'react';
import { Button, cn } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import { addToForgeQueue, useForgeQueue } from '../../lib/forge/forge-queue-store';
import { bagUpgradeOf } from '../../lib/forge/forge-queue-view';
import { forgeLevel } from './forge-labels';

export function ForgeQueueAdd({
  itemId,
  target,
  itemName,
  disabled,
  className,
}: {
  itemId: string;
  target: number;
  itemName: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useCopy();
  const queue = useForgeQueue();
  const account = useAccountView();
  const upgrade = account.status === 'loaded' ? bagUpgradeOf(account.view.payload.items, itemId) : null;
  const forged = upgrade !== null && upgrade >= target;
  const queued = !forged && queue.pieces.some((piece) => piece.itemId === itemId && piece.target === target);
  const level = forgeLevel(target);

  const onPress = useCallback(() => {
    addToForgeQueue(itemId, target);
  }, [itemId, target]);

  const label = forged ? t.forgeQueueAlreadyForged : queued ? t.forgeQueueAdded : t.forgeQueueAdd;
  const ariaLabel = forged ? t.forgeQueueAlreadyForgedAria : queued ? t.forgeQueueAddedAria : t.forgeQueueAddAria;

  return (
    <Button
      type="button"
      variant={queued || forged ? 'ghost' : 'default'}
      className={cn('whitespace-nowrap', (queued || forged) && 'text-up', className)}
      aria-pressed={forged ? undefined : queued}
      disabled={disabled || forged}
      aria-label={sub(ariaLabel, { item: itemName, target: level })}
      data-testid="forge-queue-add"
      data-queued={queued ? 'true' : undefined}
      data-forged={forged ? 'true' : undefined}
      onClick={onPress}
    >
      {label}
    </Button>
  );
}
