'use client';

import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { ItemIcon, itemPeekFromInventory } from '@bombfarm/game-art';
import { Button, cn, Icon } from '@bombfarm/ui';
import { sub, useCopy } from '../../lib/copy';
import type { DeconstructLabels } from './deconstruct-labels';

const REGION_CLASS = cn(
  'flex',
  'min-h-[5.8rem]',
  'flex-[1_1_0px]',
  'flex-col',
  'overflow-y-auto',
  'rounded-md',
  '[scrollbar-gutter:stable]',
  '[--art-tile:2.6rem]',
  'max-compact:[--art-tile:2.5rem]',
);

const GRID_CLASS = cn('m-0', 'shrink-0', 'grid', 'list-none', 'content-start', 'justify-center', 'gap-1.5', 'p-1.5', 'grid-cols-[repeat(auto-fill,var(--art-tile))]');

const REMOVE_CLASS = cn(
  'absolute',
  '-top-1.5',
  '-right-1.5',
  'z-10',
  'rounded-full',
  'bg-transparent',
  'text-ink',
  'hover:bg-transparent',
  'hover:text-down',
  '[&_svg]:[filter:drop-shadow(0_0_1px_rgb(0_0_0/0.95))_drop-shadow(0_1px_1px_rgb(0_0_0/0.7))]',
  'focus-visible:outline-2',
  'focus-visible:outline-accent',
  'disabled:cursor-not-allowed',
  'disabled:opacity-40',
);

function focusNeighbour(tile: HTMLElement): void {
  const neighbour = tile.nextElementSibling ?? tile.previousElementSibling;
  neighbour?.querySelector('button')?.focus();
}

/**
 * The batch as the game's Burn screen draws it: one square tile per ticked item, in the order they
 * were ticked, each with a bare corner mark that takes it back out and a hover card. The region keeps
 * the panel's spare height at zero, one and a hundred tiles, so the buttons under it never move.
 */
export function DeconstructBatchTiles({
  items,
  labels,
  disabled,
  onRemove,
}: {
  items: readonly InventoryViewItem[];
  labels: DeconstructLabels;
  disabled: boolean;
  onRemove: (itemId: string) => void;
}) {
  const t = useCopy();

  return (
    <div data-testid="deconstruct-batch-tiles" className={REGION_CLASS}>
      {items.length === 0 ? (
        <p
          data-testid="deconstruct-batch-empty"
          className="m-0 grid flex-1 place-items-center rounded-md border border-dashed border-line px-4 text-center text-xs leading-[1.45] text-muted"
        >
          {t.deconstructBatchEmpty}
        </p>
      ) : (
        <ul aria-label={t.deconstructBatchItemsLabel} className={GRID_CLASS}>
          {items.map((item) => {
            const name = labels.itemName(item);
            return (
              <li key={item.id} data-testid="deconstruct-batch-tile" data-item-id={item.id} className="relative">
                <ItemIcon
                  item={itemPeekFromInventory(item)}
                  size="fluid"
                  showLevel={false}
                  peek={{ lang: labels.lang, name }}
                />
                <Button
                  type="button"
                  variant="icon"
                  className={REMOVE_CLASS}
                  aria-label={sub(t.deconstructBatchRemove, { item: name })}
                  data-testid="deconstruct-batch-remove"
                  disabled={disabled}
                  onClick={(event) => {
                    const tile = event.currentTarget.closest('li');
                    if (tile) focusNeighbour(tile);
                    onRemove(item.id);
                  }}
                >
                  <Icon name="x-mark" size="xs" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
