import type { ReactNode } from 'react';
import { Accordion, accordionRecipe, cn } from '@bombfarm/ui';

export const HOLDINGS_COMPONENTS = ['inventory', 'heroes', 'skins'] as const;
export type HoldingsComponentId = (typeof HOLDINGS_COMPONENTS)[number];

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
   * What the component holds, in the order it was priced. Empty leaves the row its figure alone and
   * no disclosure to open, which is what a component holding more rows than a list can carry does —
   * it hands the reader an `action` out to the screen that lists them instead.
   */
  entries: readonly HoldingsEntry[];
}

export interface HoldingsRowLabels {
  title: string;
  /** How much of the component the figure beside it actually covers. */
  coverage: (priced: number, eligible: number) => string;
  /** Stands in for the figure when the component's account data could not be read. */
  withheld: string;
}

export interface HoldingsRowProps {
  id: HoldingsComponentId;
  component: HoldingsComponentView;
  currency: string;
  labels: HoldingsRowLabels;
  amount: (value: number, currency: string) => string;
  /** Stands in for an entry's figure when the market is listing nothing for it. */
  unpriced: string;
  /** Somewhere for the row to lead: one app routes, the other switches a tab. */
  action?: ReactNode;
  className?: string;
}

/** A row that offers no disclosure still wears the disclosure's chrome, so the three read as one set. */
const staticHeaderClass = cn(
  accordionRecipe({ tone: 'row', size: 'compact' }),
  'min-w-0 cursor-default select-text',
);

/** The revealed list, continuing the accent rail the row above it carries. */
const entriesClass =
  'm-0 flex list-none flex-col gap-0.5 border border-t-0 border-line border-l-[3px] border-l-accent bg-bg-2 px-2.5 py-2';

function rowTestId(id: HoldingsComponentId): string {
  return `account-holdings-${id}`;
}

/**
 * One component of what the account could sell, on one line: its name, how much of it the figure
 * reaches, and the figure.
 *
 * The coverage is part of the line rather than optional decoration. Only some owned things are
 * quoted at any moment, so the figure is always of a subset and a bare number would read as the
 * whole component.
 *
 * What the figure is made of sits behind the row's own disclosure, closed until asked for: the
 * three rows have to read identically at any width, and a list unrolled beneath one of them was
 * what made the section hard to parse. A component with no entries offers no disclosure at all —
 * an empty one that opens onto nothing is worse than none.
 *
 * A withheld row prints its notice in the figure's place instead: there is no number, no list, and
 * a zero would claim the component is worth nothing rather than unread.
 */
export function HoldingsRow({
  id,
  component,
  currency,
  labels,
  amount,
  unpriced,
  action,
  className,
}: HoldingsRowProps) {
  const testId = rowTestId(id);
  const entries = component.withheld ? [] : component.entries;
  const header = (
    <>
      <span className="min-w-0 flex-1 truncate text-left text-sm text-ink">{labels.title}</span>
      {component.withheld ? (
        <span data-testid={`${testId}-withheld`} className="shrink-0 text-sm text-warn">
          {labels.withheld}
        </span>
      ) : (
        <>
          <span
            data-testid={`${testId}-coverage`}
            className="shrink-0 text-[11px] whitespace-nowrap text-muted"
          >
            {labels.coverage(component.priced, component.eligible)}
          </span>
          {/* Mono, because the three figures now stack: the sans face has no tabular figures, so
              `tabular-nums` alone would leave the digits of one row not lining up with the next. */}
          <span
            data-testid={`${testId}-amount`}
            className="shrink-0 font-mono font-semibold tabular-nums text-ink"
          >
            {amount(component.amount, currency)}
          </span>
        </>
      )}
    </>
  );

  return (
    <div data-testid={testId} className={cn('min-w-0', className)}>
      {entries.length === 0 ? (
        // The action takes the trailing slot the chevron holds on the rows that open, so the three
        // stay the same shape and the same width.
        <div className={staticHeaderClass}>
          {header}
          {action}
        </div>
      ) : (
        <Accordion.Item value={id}>
          <div className="flex min-w-0 items-center gap-2">
            <Accordion.Trigger tone="row" size="compact" className="min-w-0 flex-1">
              {header}
            </Accordion.Trigger>
            {action}
          </div>
          <Accordion.Panel>
            <ul data-testid={`${testId}-entries`} className={entriesClass}>
              {entries.map((entry, position) => (
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
          </Accordion.Panel>
        </Accordion.Item>
      )}
    </div>
  );
}
