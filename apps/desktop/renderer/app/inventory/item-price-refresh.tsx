'use client';

import { useState } from 'react';
import type { MarketQuoteResult, MarketQuoteTarget } from '@bombfarm/contracts';
import { Tooltip } from '@bombfarm/ui';

/**
 * Asks Steam for one item's price right now.
 *
 * Only the desktop shell has this. The published snapshot is only ever as fresh as the last pass
 * that published it, and Electron's main process is Node — so it can call the one endpoint that
 * quotes a currency directly, which a browser cannot do at all.
 *
 * The pending state is per button rather than global: a refresh of one row must not disable the
 * rest of the page, and a slow call on one item should not read as the whole screen hanging.
 */
export function ItemPriceRefresh({
  target,
  itemName,
  label,
  onRefresh,
}: {
  target: MarketQuoteTarget;
  itemName: string;
  /** Already carries the item name — a column of identical "Refresh" buttons names nothing. */
  label: string;
  onRefresh: (target: MarketQuoteTarget) => Promise<MarketQuoteResult>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Tooltip.Provider delay={200} closeDelay={80}>
      <Tooltip.Root>
        <Tooltip.Trigger
          type="button"
          aria-label={label}
          disabled={pending}
          data-testid="item-price-refresh"
          data-item={itemName}
          className="inline-grid size-4 shrink-0 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-muted hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
          onClick={(event) => {
            event.stopPropagation();
            if (pending) return;
            setPending(true);
            void onRefresh(target).finally(() => {
              setPending(false);
            });
          }}
        >
          <svg
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={pending ? 'size-3.5 motion-safe:animate-spin' : 'size-3.5'}
          >
            <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
            <path d="M13.5 2v3.5H10" />
          </svg>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner sideOffset={6}>
            <Tooltip.Popup>
              <p className="m-0">{label}</p>
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
