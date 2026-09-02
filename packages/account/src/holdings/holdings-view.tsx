import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';
import {
  HoldingsColumn,
  type HoldingsColumnLabels,
  type HoldingsComponentView,
} from './holdings-column';

export const HOLDINGS_COMPONENTS = ['inventory', 'heroes', 'skins'] as const;
export type HoldingsComponentId = (typeof HOLDINGS_COMPONENTS)[number];

export interface HoldingsLabels {
  /** Headline caption while every component was read — the only state that may claim the account. */
  total: string;
  /** Headline caption once anything is withheld, so the figure stops reading as the whole account. */
  partialTotal: string;
  amount: (value: number, currency: string) => string;
  coverage: (priced: number, eligible: number) => string;
  /** Names the components whose account data could not be read. */
  missing: (components: readonly HoldingsComponentId[]) => string;
  components: Record<HoldingsComponentId, HoldingsColumnLabels>;
  /** Stands in for an entry's figure when the market is listing nothing for it. */
  unpriced: string;
  /** Why the heroes figure is a floor: the market identifies a hero by rarity and nothing else. */
  heroesAreAFloor: string;
  /** Why the skins figure can fall without anything having been sold. */
  skinsCountedWhileWorn: string;
}

export interface HoldingsViewProps {
  /** Every component summed, in `currency`. */
  total: number;
  currency: string;
  inventory: HoldingsComponentView;
  heroes: HoldingsComponentView;
  skins: HoldingsComponentView;
  labels: HoldingsLabels;
  /** Sits in the inventory column: one app routes to the Inventory screen, the other switches a tab. */
  inventoryLink?: ReactNode;
  /** How old the prices behind the figures are — shown beside the coverage, not as a claim of its
   *  own. */
  footnote?: string;
  className?: string;
}

/**
 * What the market says a whole account could sell right now: the inventory, the sellable heroes,
 * and the skins those heroes are wearing, each over the count its figure reaches.
 *
 * The three sit side by side and fall back to a stack as the measure narrows, because the desktop
 * window resizes down to a small width and the planner is read on narrow viewports; the column
 * count follows the width available rather than a fixed three.
 *
 * Withholding is derived from the components rather than taken as a prop, because the headline's
 * honesty depends on it. A component whose account data could not be read makes `total` cover only
 * part of the account, so the caption changes and the unread ones are named — the number stays on
 * screen but stops presenting itself as what the account is worth.
 *
 * The two sentences under the columns are permanent text rather than tips. Each explains a figure
 * that is routinely read as something it is not, and an explanation nobody hovers is one nobody
 * reads.
 */
export function HoldingsView({
  total,
  currency,
  inventory,
  heroes,
  skins,
  labels,
  inventoryLink,
  footnote,
  className,
}: HoldingsViewProps) {
  const components: Record<HoldingsComponentId, HoldingsComponentView> = {
    inventory,
    heroes,
    skins,
  };
  const withheld = HOLDINGS_COMPONENTS.filter((id) => components[id].withheld);
  const wasRead = HOLDINGS_COMPONENTS.filter((id) => !components[id].withheld);
  const countOf = (pick: (component: HoldingsComponentView) => number) =>
    wasRead.reduce((running, id) => running + pick(components[id]), 0);

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
            countOf((component) => component.priced),
            countOf((component) => component.eligible),
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

      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] items-start gap-x-6 gap-y-1 border-t border-line px-4 py-1">
        <HoldingsColumn
          testId="account-holdings-inventory"
          component={inventory}
          currency={currency}
          labels={labels.components.inventory}
          amount={labels.amount}
          unpriced={labels.unpriced}
          action={inventoryLink}
        />
        <HoldingsColumn
          testId="account-holdings-heroes"
          component={heroes}
          currency={currency}
          labels={labels.components.heroes}
          amount={labels.amount}
          unpriced={labels.unpriced}
        />
        <HoldingsColumn
          testId="account-holdings-skins"
          component={skins}
          currency={currency}
          labels={labels.components.skins}
          amount={labels.amount}
          unpriced={labels.unpriced}
        />
      </div>

      <div className="flex flex-col gap-1 border-t border-line px-4 py-3 text-[11px] text-muted">
        <span data-testid="account-holdings-heroes-floor">{labels.heroesAreAFloor}</span>
        <span data-testid="account-holdings-skins-worn">{labels.skinsCountedWhileWorn}</span>
      </div>
    </div>
  );
}
