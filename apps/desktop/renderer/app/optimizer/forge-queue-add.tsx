'use client';

/**
 * The control the desktop draws on each entry of an Optimizer hero's forge queue: one press puts
 * the piece and its target on the forge queue, and the button then says so. Pressing it again
 * changes nothing — the queue keeps one entry per piece — so it reads as a state, not a toggle.
 */
import { useCallback } from 'react';
import { Button, cn } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import { addToForgeQueue, useForgeQueue } from '../../lib/forge/forge-queue-store';
import { forgeLevel } from '../forge/forge-labels';

export function ForgeQueueAdd({ itemId, target, itemName }: { itemId: string; target: number; itemName: string }) {
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
      className={cn('whitespace-nowrap', queued && 'text-up')}
      aria-pressed={queued}
      aria-label={sub(queued ? t.forgeQueueAddedAria : t.forgeQueueAddAria, { item: itemName, target: level })}
      data-testid="forge-queue-add"
      data-queued={queued ? 'true' : undefined}
      onClick={onPress}
    >
      {queued ? t.forgeQueueAdded : t.forgeQueueAdd}
    </Button>
  );
}
