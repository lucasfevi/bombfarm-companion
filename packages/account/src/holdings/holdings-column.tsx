import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';

export interface HoldingsEntry {
  /** Already resolved by the host — this package names nothing itself. */
  name: string;
  /**
   * What tells two entries the market prices identically apart. A hero is quoted on its rarity and
   * nothing else, so the rarity is what makes a repeated figure legible; skins carry none.
   */
  detail?: string;
  /**
   * The entry's leading cell, already drawn by the host, in place of the name and its detail.
   *
   * A hero is depicted with its avatar, rank, rarity and level everywhere else in both apps, and
   * that depiction needs a language this package deliberately does not have. So the app that has
   * one draws it and hands the node over; an entry with nothing more to say than a name — a skin —
   * passes none and keeps the plain pair.
   */
  leading?: ReactNode;
  /** This entry's price in the view's currency, or null when nothing is listed for it right now. */
  amount: number | null;
}

export interface HoldingsComponentView {
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
  /**
   * What the component holds, in the order it was priced. Empty leaves the column a figure alone,
   * which is what a component holding more rows than a column can carry does — it hands the reader
   * an `action` out to the screen that lists them instead.
   */
  entries: readonly HoldingsEntry[];
}

export interface HoldingsColumnLabels {
  title: string;
  /** How much of the component the figure above it actually covers. */
  coverage: (priced: number, eligible: number) => string;
  /** Stands in for the figure when the component's account data could not be read. */
  withheld: string;
}

export interface HoldingsColumnProps {
  testId: string;
  component: HoldingsComponentView;
  currency: string;
  labels: HoldingsColumnLabels;
  amount: (value: number, currency: string) => string;
  /** Stands in for an entry's figure when the market is listing nothing for it. */
  unpriced: string;
  /** Somewhere for the column to lead: one app routes, the other switches a tab. */
  action?: ReactNode;
  className?: string;
}

/**
 * One component of what the account could sell, over the count that figure reaches, above the
 * things the figure is made of.
 *
 * The coverage line is mandatory rather than optional decoration. Only some owned things are quoted
 * at any moment, so the figure is always of a subset and a bare number would read as the whole
 * component. The entries are what make that line investigable: an entry the market is listing
 * nothing for is printed and marked, never dropped, so "1 of 2 priced" can be read as *which* one
 * rather than taken on trust.
 *
 * A withheld column prints its notice in the figure's place instead: there is no number, no list,
 * and a zero would claim the component is worth nothing rather than unread.
 */
export function HoldingsColumn({
  testId,
  component,
  currency,
  labels,
  amount,
  unpriced,
  action,
  className,
}: HoldingsColumnProps) {
  return (
    <div data-testid={testId} className={cn('flex min-w-0 flex-col gap-1.5 py-2.5', className)}>
      <span className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-sm text-ink">{labels.title}</span>
        {action}
      </span>
      {component.withheld ? (
        <span data-testid={`${testId}-withheld`} className="text-sm text-warn">
          {labels.withheld}
        </span>
      ) : (
        <>
          <span className="flex flex-col gap-0.5">
            <span
              data-testid={`${testId}-amount`}
              className="text-sm leading-none font-semibold tabular-nums text-ink"
            >
              {amount(component.amount, currency)}
            </span>
            <span data-testid={`${testId}-coverage`} className="text-[11px] text-muted">
              {labels.coverage(component.priced, component.eligible)}
            </span>
          </span>
          {component.entries.length === 0 ? null : (
            <ul
              data-testid={`${testId}-entries`}
              className="m-0 flex list-none flex-col gap-0.5 border-t border-line pt-1.5 pl-0"
            >
              {component.entries.map((entry, position) => (
                <li
                  key={`${String(position)}-${entry.name}`}
                  data-testid={`${testId}-entry`}
                  className={cn(
                    'flex justify-between gap-2',
                    entry.leading == null ? 'items-baseline' : 'items-center',
                  )}
                >
                  {entry.leading == null ? (
                    <span className="flex min-w-0 items-baseline gap-1">
                      <span
                        data-testid={`${testId}-entry-name`}
                        className="truncate text-[11px] text-ink"
                      >
                        {entry.name}
                      </span>
                      {entry.detail == null ? null : (
                        <span
                          data-testid={`${testId}-entry-detail`}
                          className="shrink-0 text-[10px] text-muted"
                        >
                          {entry.detail}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span data-testid={`${testId}-entry-leading`} className="flex min-w-0">
                      {entry.leading}
                    </span>
                  )}
                  {entry.amount == null ? (
                    <span
                      data-testid={`${testId}-entry-unpriced`}
                      className="shrink-0 text-[10px] text-muted"
                    >
                      {unpriced}
                    </span>
                  ) : (
                    <span
                      data-testid={`${testId}-entry-amount`}
                      className="shrink-0 font-mono text-[11px] tabular-nums text-ink"
                    >
                      {amount(entry.amount, currency)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
