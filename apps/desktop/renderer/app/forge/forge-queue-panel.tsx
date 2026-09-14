'use client';

/**
 * The queued pieces on the Forge tab, in the order they will be forged, each with its target and
 * a way off the queue, with the queue's own Start and Cancel under them. The piece rolling stays
 * — Cancel is how it stops — and a piece the bag no longer holds is named by its id until the
 * next account read drops it.
 */
import type { AccountSource } from '@bombfarm/contracts';
import { ItemIcon } from '@bombfarm/game-art';
import { Button, Icon, Panel, PanelHeader, Tooltip, cn, mutedClass } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import type { ForgeQueueState } from '../../lib/forge/forge-queue-reducer';
import type { ForgeQueueRow } from '../../lib/forge/forge-queue-view';
import { forgeLevel, type ForgeLabels } from './forge-labels';
import { ForgeQueueActions } from './forge-queue-actions';

export function ForgeQueuePanel({
  queue,
  rows,
  labels,
  onRemove,
  forgeWritesEnabled,
  accountSource,
}: {
  queue: ForgeQueueState;
  rows: readonly ForgeQueueRow[];
  labels: ForgeLabels;
  onRemove: (itemId: string) => void;
  forgeWritesEnabled: boolean;
  accountSource: AccountSource | null;
}) {
  const t = useCopy();
  if (rows.length === 0) return null;

  return (
    <Panel data-testid="forge-queue-panel" className="flex flex-col gap-2">
      <PanelHeader title={t.forgeQueueTitle} />
      <Tooltip.Provider delay={200} closeDelay={80}>
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
          {rows.map(({ piece, item }) => {
            const rolling = queue.active?.itemId === piece.itemId;
            const halted = queue.halt?.itemId === piece.itemId;
            const name = item === null ? piece.itemId : labels.itemName(item);
            return (
              <li
                key={piece.itemId}
                data-testid="forge-queue-row"
                data-item-id={piece.itemId}
                data-rolling={rolling ? 'true' : undefined}
                className={cn(
                  'flex',
                  'items-center',
                  'gap-2',
                  'rounded-sm',
                  'border',
                  'px-2',
                  'py-1.5',
                  rolling ? 'border-accent/60' : halted ? 'border-warn/60' : 'border-line',
                )}
              >
                {item === null ? (
                  <span aria-hidden className="size-8 shrink-0 rounded-sm border border-dashed border-line" />
                ) : (
                  <ItemIcon item={item} size="sm" />
                )}
                <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{name}</span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-ink">
                  {forgeLevel(item?.upgrade ?? 0)} → {forgeLevel(piece.target)}
                </span>
                {rolling ? (
                  <span className={cn('shrink-0', mutedClass)}>{t.forgeQueueRolling}</span>
                ) : (
                  <Tooltip.Root>
                    <Tooltip.Trigger
                      render={
                        <Button
                          type="button"
                          variant="icon"
                          aria-label={sub(t.forgeQueueRemove, { item: name })}
                          data-testid="forge-queue-remove"
                          onClick={() => {
                            onRemove(piece.itemId);
                          }}
                        >
                          <Icon name="x-mark" size="sm" />
                        </Button>
                      }
                    />
                    <Tooltip.Portal>
                      <Tooltip.Positioner sideOffset={6}>
                        <Tooltip.Popup>
                          <p className="m-0">{sub(t.forgeQueueRemove, { item: name })}</p>
                        </Tooltip.Popup>
                      </Tooltip.Positioner>
                    </Tooltip.Portal>
                  </Tooltip.Root>
                )}
              </li>
            );
          })}
        </ol>
      </Tooltip.Provider>
      <p className={cn('m-0', mutedClass)}>{t.forgeQueuePanelCaption}</p>
      <ForgeQueueActions
        queue={queue}
        rows={rows}
        labels={labels}
        forgeWritesEnabled={forgeWritesEnabled}
        accountSource={accountSource}
      />
    </Panel>
  );
}
