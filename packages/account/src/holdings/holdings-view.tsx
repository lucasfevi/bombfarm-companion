import type { ReactNode } from 'react';
import { Accordion, Panel, cn, panelHClass, panelTitleClass } from '@bombfarm/ui';
import {
  HOLDINGS_COMPONENTS,
  HoldingsRow,
  type HoldingsComponentId,
  type HoldingsComponentView,
  type HoldingsRowLabels,
} from './holdings-row';

export interface HoldingsLabels {
  /** The section's name, in the same heading the panels beside it carry. */
  title: string;
  /**
   * Sits against the figure once anything is withheld. The title cannot say this — it is fixed —
   * and without it a sum over part of the account reads as what the whole account is worth.
   */
  partial: string;
  amount: (value: number, currency: string) => string;
  coverage: (priced: number, eligible: number) => string;
  /** Names the components whose account data could not be read. */
  missing: (components: readonly HoldingsComponentId[]) => string;
  components: Record<HoldingsComponentId, HoldingsRowLabels>;
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
  /** Sits in the inventory row: one app routes to the Inventory screen, the other switches a tab. */
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
 * The three are always three rows, at every width. They were columns the available width sized,
 * and the third wrapped under a component it had nothing to do with as the window narrowed, which
 * left the reader unable to tell which figure belonged to what.
 *
 * Withholding is derived from the components rather than taken as a prop, because the figure's
 * honesty depends on it. A component whose account data could not be read makes `total` cover only
 * part of the account, so the figure is qualified where it stands and the unread ones are named —
 * the number stays on screen but stops presenting itself as what the account is worth.
 *
 * The two sentences under the rows are permanent text rather than tips. Each explains a figure that
 * is routinely read as something it is not, and an explanation nobody hovers is one nobody reads.
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
    <Panel data-testid="account-holdings" className={cn('flex flex-col', className)}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{labels.title}</h2>
      </div>

      <div className="mb-2.5 flex flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span
            data-testid="account-holdings-total"
            className="text-3xl leading-none font-bold tabular-nums text-accent"
          >
            {labels.amount(total, currency)}
          </span>
          {withheld.length === 0 ? null : (
            <span data-testid="account-holdings-partial" className="text-xs text-warn">
              {labels.partial}
            </span>
          )}
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

      {/* One column, never a grid: the width may change what a row can fit, never how many rows
          there are or which figure belongs to which name. */}
      <Accordion.Root multiple className="flex flex-col gap-1">
        <HoldingsRow
          id="inventory"
          component={inventory}
          currency={currency}
          labels={labels.components.inventory}
          amount={labels.amount}
          unpriced={labels.unpriced}
          action={inventoryLink}
        />
        <HoldingsRow
          id="heroes"
          component={heroes}
          currency={currency}
          labels={labels.components.heroes}
          amount={labels.amount}
          unpriced={labels.unpriced}
        />
        <HoldingsRow
          id="skins"
          component={skins}
          currency={currency}
          labels={labels.components.skins}
          amount={labels.amount}
          unpriced={labels.unpriced}
        />
      </Accordion.Root>

      <div className="mt-2.5 flex flex-col gap-1 border-t border-line pt-2.5 text-[11px] text-muted">
        <span data-testid="account-holdings-heroes-floor">{labels.heroesAreAFloor}</span>
        <span data-testid="account-holdings-skins-worn">{labels.skinsCountedWhileWorn}</span>
      </div>
    </Panel>
  );
}
