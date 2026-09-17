'use client';

/**
 * The forge queue in the band under the top bar: how many pieces it has forged of how many, the
 * piece at its head — its icon opening the item's card — with how far it has come while it rolls,
 * and the queue's controls. Drawn by the shell rather than by
 * a tab so the queue is in sight and in reach on every screen — the piece rolling is main's, and
 * only the Forge tab draws its rail. The shell mounts it only while the queue holds anything.
 *
 * Mounted on every screen for as long as there is a queue, so this is also where the queue is
 * kept true to the bag: every account read drops a waiting piece that is gone or already at its
 * target.
 */
import { useEffect, useMemo } from 'react';
import type { AccountSource } from '@bombfarm/contracts';
import { buildInventoryView } from '@bombfarm/domain/inventory-view';
import { ItemIcon, itemPeekFromInventory } from '@bombfarm/game-art';
import { cn } from '@bombfarm/ui';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { useAccountView } from '../../lib/account/use-account-view';
import type { ForgeQueueState } from '../../lib/forge/forge-queue-reducer';
import { syncForgeQueue, useForgeQueue } from '../../lib/forge/forge-queue-store';
import { bagUpgrades, resolveForgeQueue } from '../../lib/forge/forge-queue-view';
import { gearOf } from '../../lib/forge/forge-rows';
import { useForgeRun } from '../../lib/forge/forge-run-store';
import { forgeLabels, forgeLevel } from './forge-labels';
import { ForgeQueueActions } from './forge-queue-actions';

const NO_GEAR: never[] = [];

export function isForgeQueueShown(queue: ForgeQueueState): boolean {
  return queue.pieces.length > 0 || queue.active !== null;
}

export function ForgeQueueBar({
  forgeWritesEnabled,
  accountSource,
  onOpenForge,
}: {
  forgeWritesEnabled: boolean;
  accountSource: AccountSource | null;
  /** The band's name is the way to the Forge tab, where the queue is listed in full. */
  onOpenForge: () => void;
}) {
  const t = useCopy();
  const { lang, locale } = useLocale();
  const queue = useForgeQueue();
  const run = useForgeRun();
  const account = useAccountView();

  const shown = isForgeQueueShown(queue);
  const items = shown && account.status === 'loaded' ? account.view.payload.items : undefined;
  const gear = useMemo(() => (items === undefined ? NO_GEAR : gearOf(buildInventoryView(items).items)), [items]);
  const labels = useMemo(() => forgeLabels(t, lang, locale), [t, lang, locale]);

  useEffect(() => {
    if (items === undefined) return;
    syncForgeQueue(bagUpgrades(gear));
  }, [items, gear]);

  const rows = useMemo(() => resolveForgeQueue(queue.pieces, gear), [queue.pieces, gear]);

  if (!shown) return null;

  const queueRunId = queue.active?.runId ?? null;
  const inFlight = queueRunId !== null && run.status === 'running' && run.run.runId === queueRunId ? run.run : null;
  const head = rows[0] ?? null;
  const headName = head === null ? '' : head.item === null ? head.piece.itemId : labels.itemName(head.item);

  return (
    <div data-testid="forge-queue-bar" data-status={queue.status} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button"
        aria-label={t.forgeQueueOpenForge}
        data-testid="forge-queue-open-forge"
        className={cn(
          'cursor-pointer',
          'border-0',
          'bg-transparent',
          'p-0',
          'font-semibold',
          'text-ink',
          'underline-offset-2',
          'hover:text-accent',
          'hover:underline',
          'focus-visible:rounded-sm',
          'focus-visible:[outline-style:solid]',
          'focus-visible:outline-2',
          'focus-visible:outline-offset-2',
          'focus-visible:outline-accent',
        )}
        onClick={onOpenForge}
      >
        {t.forgeQueueTitle}
      </button>
      <span data-testid="forge-queue-count" className="font-mono text-[12px] tabular-nums text-muted">
        {sub(t.forgeQueueForged, { done: queue.forged, total: queue.forged + queue.pieces.length })}
      </span>
      {head !== null ? (
        <span data-testid="forge-queue-in-flight" className="flex min-w-0 items-center gap-1.5 text-[12px]">
          {head.item !== null ? (
            <ItemIcon
              item={itemPeekFromInventory(head.item)}
              size="xs"
              showLevel={false}
              showUpgrade={false}
              peek={{ lang, name: headName }}
            />
          ) : null}
          <span className="truncate text-ink">{headName}</span>
          <span className="font-mono tabular-nums text-ink">
            {forgeLevel(inFlight?.upgrade ?? head.item?.upgrade ?? 0)} → {forgeLevel(head.piece.target)}
          </span>
          {queue.active !== null ? (
            <span className="text-muted">
              {inFlight === null
                ? t.forgeQueueRolling
                : sub(t.forgeQueueProgress, { rolls: labels.count(inFlight.tally.rolls), spent: labels.gold(inFlight.tally.spent) })}
            </span>
          ) : null}
        </span>
      ) : null}
      <div className="ml-auto">
        <ForgeQueueActions
          queue={queue}
          rows={rows}
          labels={labels}
          forgeWritesEnabled={forgeWritesEnabled}
          accountSource={accountSource}
        />
      </div>
    </div>
  );
}
