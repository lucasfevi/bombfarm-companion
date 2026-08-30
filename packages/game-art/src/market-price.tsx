import type { ReactNode, SyntheticEvent } from 'react';
import { Tooltip, cn } from '@bombfarm/ui';

/**
 * What this component needs of a resolved market price.
 *
 * Declared structurally rather than imported from the pricing package, which keeps a presentation
 * package free of a data dependency while still accepting a `ResolvedPrice` as-is — it carries
 * every field here, so no mapping layer sits between the two.
 */
export interface MarketPriceView {
  state: 'not-tradable' | 'unknown' | 'no-listing' | 'priced';
  amount: number | null;
  currency: string;
  /** `native` is the number on the linked page; `converted` is USD at the day's rate. */
  basis: 'native' | 'converted';
  listingUrl: string | null;
  quotedUtc: string | null;
  listings: number;
}

export interface MarketPriceLabels {
  amount: (amount: number, currency: string) => string;
  /** Tooltip body: which of the two bases this figure is, and how old the quote behind it is. */
  title: (price: MarketPriceView) => string;
  /** What stands in for a number when there is none. */
  unpriced: (state: Exclude<MarketPriceView['state'], 'priced'>) => string;
}

const STEAM_PATH =
  'M11.98 0C5.67 0 .5 4.87 0 11.05l6.44 2.66a3.4 3.4 0 0 1 1.92-.59l2.87-4.15v-.06a4.54 4.54 0 1 1 4.54 4.54h-.1l-4.1 2.92c0 .05 0 .1 0 .15a3.41 3.41 0 0 1-6.76.66L.05 15.2A12 12 0 1 0 11.98 0zM7.5 18.2l-1.47-.61a2.56 2.56 0 0 0 1.33 1.26 2.57 2.57 0 0 0 3.35-1.39 2.55 2.55 0 0 0 0-1.96 2.53 2.53 0 0 0-1.4-1.38 2.56 2.56 0 0 0-1.94.02l1.52.63a1.89 1.89 0 1 1-1.45 3.48zm11.3-8.83a3.03 3.03 0 1 0-6.06 0 3.03 3.03 0 0 0 6.06 0zm-5.3 0a2.28 2.28 0 1 1 4.55 0 2.28 2.28 0 0 1-4.55 0z';

function stopRowActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

function SteamGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false" className={cn('size-3.5 shrink-0', className)}>
      <path d={STEAM_PATH} fill="currentColor" />
    </svg>
  );
}

/**
 * The Steam Community Market price for one item, above the in-game gold value.
 *
 * A converted figure is marked with a `~`, because Steam prices each region independently rather
 * than converting: the number would not match the page this links to, and the link invites the
 * reader to check. An exact quote carries no marker — the common case should not look qualified.
 *
 * Renders nothing at all for an item the game marks untradable, which can never have a price;
 * a dash would suggest one is merely missing.
 */
export function MarketPrice({
  price,
  labels,
  className,
  action,
}: {
  price: MarketPriceView;
  labels: MarketPriceLabels;
  className?: string;
  /** Slot for a refresh control, placed after the price so the link stays first in tab order. */
  action?: ReactNode;
}) {
  if (price.state === 'not-tradable') return null;

  const priced = price.state === 'priced' && price.amount != null;

  const body = priced ? (
    <>
      {price.basis === 'converted' ? <span aria-hidden>~</span> : null}
      {labels.amount(price.amount ?? 0, price.currency)}
    </>
  ) : (
    <span className="text-muted">{labels.unpriced(price.state as 'unknown' | 'no-listing')}</span>
  );

  const tip = priced ? labels.title(price) : null;

  const { listingUrl } = price;

  return (
    <span className={cn('inline-flex items-center gap-1 text-xs tabular-nums', className)}>
      <Tooltip.Provider delay={200} closeDelay={80}>
        <Tooltip.Root>
          <Tooltip.Trigger
            render={
              listingUrl == null ? (
                <span />
              ) : (
                <a
                  href={listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={stopRowActivation}
                />
              )
            }
            className={cn(
              'inline-flex items-center gap-1',
              listingUrl != null &&
                'rounded-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
          >
            <SteamGlyph />
            <span>{body}</span>
          </Tooltip.Trigger>
          {tip == null ? null : (
            <Tooltip.Portal>
              <Tooltip.Positioner sideOffset={6}>
                <Tooltip.Popup>
                  <p className="m-0">{tip}</p>
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>
      {action}
    </span>
  );
}
