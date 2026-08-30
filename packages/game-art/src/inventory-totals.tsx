import { cn } from '@bombfarm/ui';

export interface InventoryTotalsLabels {
  title: string;
  amount: (value: number, currency: string) => string;
  /** How much of the inventory the figure actually covers, e.g. "12 of 47 tradable items priced". */
  coverage: (priced: number, tradable: number) => string;
}

export interface InventoryTotalsProps {
  /** Summed market price of every item currently quoted, in `currency`. */
  total: number;
  currency: string;
  /** Items the market is quoting a price for right now. */
  priced: number;
  /** Items the game permits selling at all — the only ones that could ever be priced. */
  tradable: number;
  labels: InventoryTotalsLabels;
  className?: string;
}

/**
 * What the market says the inventory is worth, over the count it could actually reach.
 *
 * The coverage line is not decoration. Only some owned items are quoted at any moment — the rest
 * are listed nowhere, or have never appeared on the market at all — so the total is always of a
 * subset, and a bare number would read as the whole inventory's worth. Untradable items are left
 * out of the denominator entirely: the game forbids selling them, so they were never candidates
 * and counting them would make coverage look worse than it is.
 *
 * Deliberately unaffected by the filters. This is what the account holds, not what the current
 * view shows, so narrowing to one set does not restate it as a smaller fortune.
 */
export function InventoryTotals({
  total,
  currency,
  priced,
  tradable,
  labels,
  className,
}: InventoryTotalsProps) {
  return (
    <div
      data-testid="inventory-totals"
      className={cn(
        'flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-sm border border-line bg-bg-2 px-3 py-2',
        className,
      )}
    >
      <span className="text-[11px] tracking-[0.04em] text-muted uppercase">{labels.title}</span>
      <span className="flex items-baseline gap-2">
        <span className="text-sm font-semibold tabular-nums text-ink">
          {labels.amount(total, currency)}
        </span>
        <span className="text-xs text-muted">{labels.coverage(priced, tradable)}</span>
      </span>
    </div>
  );
}
