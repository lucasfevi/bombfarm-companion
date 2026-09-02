import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';

export interface HoldingsRowView {
  /** Summed market price of everything in this component quoted right now. */
  amount: number;
  /** Things the market is quoting a price for right now. */
  priced: number;
  /**
   * Things that could carry a price at all: the market knows what they are, and the game permits
   * selling them. Anything else was never a candidate and is absent from both counts — counting it
   * would make coverage look worse than it is.
   */
  eligible: number;
  /** True when this component's account data could not be read at all. */
  withheld: boolean;
}

export interface HoldingsRowLabels {
  title: string;
  /** How much of the component the figure beside it actually covers. */
  coverage: (priced: number, eligible: number) => string;
  /** Stands in for the figure when the component's account data could not be read. */
  withheld: string;
}

export interface HoldingsRowProps {
  testId: string;
  row: HoldingsRowView;
  currency: string;
  labels: HoldingsRowLabels;
  amount: (value: number, currency: string) => string;
  /** Somewhere for the row to lead: one app routes, the other switches a tab. */
  action?: ReactNode;
  className?: string;
}

/**
 * One component of what the account could sell, over the count that figure reaches.
 *
 * The coverage line is mandatory rather than optional decoration. Only some owned things are quoted
 * at any moment, so the figure is always of a subset and a bare number would read as the whole
 * component. A withheld row prints its notice in the figure's place instead: there is no number,
 * and a zero would claim the component is worth nothing rather than unread.
 */
export function HoldingsRow({
  testId,
  row,
  currency,
  labels,
  amount,
  action,
  className,
}: HoldingsRowProps) {
  return (
    <div
      data-testid={testId}
      className={cn('flex items-baseline justify-between gap-3 py-2.5', className)}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm text-ink">{labels.title}</span>
        {action}
      </span>
      {row.withheld ? (
        <span data-testid={`${testId}-withheld`} className="text-sm text-warn">
          {labels.withheld}
        </span>
      ) : (
        <span className="flex flex-col items-end gap-0.5">
          <span
            data-testid={`${testId}-amount`}
            className="text-sm leading-none font-semibold tabular-nums text-ink"
          >
            {amount(row.amount, currency)}
          </span>
          <span data-testid={`${testId}-coverage`} className="text-[11px] text-muted">
            {labels.coverage(row.priced, row.eligible)}
          </span>
        </span>
      )}
    </div>
  );
}
