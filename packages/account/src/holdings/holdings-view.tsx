import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';
import { HoldingsRow, type HoldingsRowLabels, type HoldingsRowView } from './holdings-row';

export const HOLDINGS_ROWS = ['bag', 'heroes', 'skins'] as const;
export type HoldingsRowId = (typeof HOLDINGS_ROWS)[number];

export interface HoldingsLabels {
  /** Headline caption while every row was read — the only state that may claim the whole account. */
  total: string;
  /** Headline caption once anything is withheld, so the figure stops reading as the whole account. */
  partialTotal: string;
  amount: (value: number, currency: string) => string;
  coverage: (priced: number, eligible: number) => string;
  /** Names the rows whose account data could not be read. */
  missing: (rows: readonly HoldingsRowId[]) => string;
  rows: Record<HoldingsRowId, HoldingsRowLabels>;
  /** Why the heroes figure is a floor: the market identifies a hero by rarity and nothing else. */
  heroesAreAFloor: string;
  /** Why the skins figure can fall without anything having been sold. */
  skinsCountedWhileWorn: string;
}

export interface HoldingsViewProps {
  /** Every row summed, in `currency`. */
  total: number;
  currency: string;
  bag: HoldingsRowView;
  heroes: HoldingsRowView;
  skins: HoldingsRowView;
  labels: HoldingsLabels;
  /** Sits in the bag row: one app routes to the inventory, the other switches a tab. */
  bagLink?: ReactNode;
  /** How old the prices behind the figures are — shown beside the coverage, not as a claim of its
   *  own. */
  footnote?: string;
  className?: string;
}

/**
 * What the market says a whole account could sell right now: the bag, the sellable heroes, and the
 * skins those heroes are wearing, each over the count its figure reaches.
 *
 * Withholding is derived from the rows rather than taken as a prop, because the headline's honesty
 * depends on it. A row whose account data could not be read makes `total` cover only part of the
 * account, so the caption changes and the unread rows are named — the number stays on screen but
 * stops presenting itself as what the account is worth.
 *
 * The two sentences under the rows are permanent text rather than tips. Each explains a figure that
 * is routinely read as something it is not, and an explanation nobody hovers is one nobody reads.
 */
export function HoldingsView({
  total,
  currency,
  bag,
  heroes,
  skins,
  labels,
  bagLink,
  footnote,
  className,
}: HoldingsViewProps) {
  const rows: Record<HoldingsRowId, HoldingsRowView> = { bag, heroes, skins };
  const withheld = HOLDINGS_ROWS.filter((id) => rows[id].withheld);
  const wasRead = HOLDINGS_ROWS.filter((id) => !rows[id].withheld);
  const countOf = (pick: (row: HoldingsRowView) => number) =>
    wasRead.reduce((running, id) => running + pick(rows[id]), 0);

  return (
    <div
      data-testid="account-holdings"
      className={cn('flex flex-col rounded-sm border border-line bg-bg-2', className)}
    >
      <div className="flex flex-col gap-0.5 px-4 py-3">
        <span
          data-testid="account-holdings-caption"
          className="text-[11px] tracking-[0.06em] text-muted uppercase"
        >
          {withheld.length === 0 ? labels.total : labels.partialTotal}
        </span>
        <span
          data-testid="account-holdings-total"
          className="text-3xl leading-none font-bold tabular-nums text-accent"
        >
          {labels.amount(total, currency)}
        </span>
        <span className="text-xs text-muted">
          {labels.coverage(
            countOf((row) => row.priced),
            countOf((row) => row.eligible),
          )}
          {footnote == null ? null : (
            <span data-testid="account-holdings-footnote" className="ml-2 opacity-70">
              {footnote}
            </span>
          )}
        </span>
        {withheld.length === 0 ? null : (
          <span data-testid="account-holdings-missing" className="text-xs text-warn">
            {labels.missing(withheld)}
          </span>
        )}
      </div>

      <div className="flex flex-col divide-y divide-line border-t border-line px-4">
        <HoldingsRow
          testId="account-holdings-bag"
          row={bag}
          currency={currency}
          labels={labels.rows.bag}
          amount={labels.amount}
          action={bagLink}
        />
        <HoldingsRow
          testId="account-holdings-heroes"
          row={heroes}
          currency={currency}
          labels={labels.rows.heroes}
          amount={labels.amount}
        />
        <HoldingsRow
          testId="account-holdings-skins"
          row={skins}
          currency={currency}
          labels={labels.rows.skins}
          amount={labels.amount}
        />
      </div>

      <div className="flex flex-col gap-1 border-t border-line px-4 py-3 text-[11px] text-muted">
        <span data-testid="account-holdings-heroes-floor">{labels.heroesAreAFloor}</span>
        <span data-testid="account-holdings-skins-worn">{labels.skinsCountedWhileWorn}</span>
      </div>
    </div>
  );
}
