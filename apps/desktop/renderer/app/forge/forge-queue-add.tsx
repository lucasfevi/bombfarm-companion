'use client';

/**
 * The control that puts a piece and a target on the forge queue — on each entry of an Optimizer
 * hero's forge queue, and under the Forge button on the plan panel. One press queues it and the
 * button then says so; pressing it again changes nothing, since the queue keeps one entry per
 * piece, so it reads as a state, not a toggle. It spends nothing itself: the footer's Start is
 * where the gold question is asked.
 */
import { useCallback } from 'react';
import { Button, cn } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { addToForgeQueue, useForgeQueue } from '../../lib/forge/forge-queue-store';
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
  const queued = queue.pieces.some((piece) => piece.itemId === itemId && piece.target === target);
  const level = forgeLevel(target);

  const onPress = useCallback(() => {
    addToForgeQueue(itemId, target);
  }, [itemId, target]);

  return (
    <Button
      type="button"
      variant={queued ? 'ghost' : 'default'}
      className={cn('whitespace-nowrap', queued && 'text-up', className)}
      aria-pressed={queued}
      disabled={disabled}
      aria-label={sub(queued ? t.forgeQueueAddedAria : t.forgeQueueAddAria, { item: itemName, target: level })}
      data-testid="forge-queue-add"
      data-queued={queued ? 'true' : undefined}
      onClick={onPress}
    >
      {queued ? t.forgeQueueAdded : t.forgeQueueAdd}
    </Button>
  );
}
