import type { PriceableHero, PriceableItem, ResolvedPrice } from './resolve.js';
import { resolveHeroPrice, resolveItemPrice, resolveSkinPrice } from './resolve.js';
import { FIRST_BOUGHT_SKIN_INDEX } from './tags.js';
import type { MarketSnapshot } from './types.js';

/**
 * The distinct bought skins a roster is wearing, sorted.
 *
 * Distinct is the point: a bought skin is an account-wide unlock, so one purchase dresses any
 * number of heroes and the account holds exactly one of it however many are wearing it. Birth skins
 * cost nothing and are dropped.
 */
export function boughtSkinsWorn(skinValues: readonly number[]): number[] {
  const bought = new Set<number>();
  for (const skin of skinValues) {
    if (skin >= FIRST_BOUGHT_SKIN_INDEX) bought.add(skin);
  }
  return [...bought].sort((left, right) => left - right);
}

export const HOLDING_COMPONENTS = ['bag', 'heroes', 'skins'] as const;
export type HoldingComponent = (typeof HOLDING_COMPONENTS)[number];

export interface HoldingsTally {
  /** Summed market price of everything in this component quoted right now. */
  amount: number;
  /** Things the market is quoting a price for right now. */
  priced: number;
  /**
   * Things that could carry a price at all: the market knows what they are, and the game permits
   * selling them. Anything the game forbids selling is absent from this and from `amount` both — it
   * was never a candidate, and counting it would make coverage look worse than it is.
   */
  eligible: number;
  /** True when the caller could not supply this component's account data at all. */
  withheld: boolean;
}

export interface AccountHoldings {
  /** The currency asked for, upper-cased. */
  currency: string;
  /** `bag`, `heroes` and `skins` summed. */
  total: number;
  priced: number;
  eligible: number;
  bag: HoldingsTally;
  heroes: HoldingsTally;
  skins: HoldingsTally;
  /**
   * The components whose account data the caller could not supply. A non-empty list means `total`
   * covers only part of the account and must not be shown as what the account is worth.
   */
  withheld: HoldingComponent[];
  /** True only when nothing was withheld, so `total` spans the whole account. */
  complete: boolean;
}

export interface AccountHoldingsInput {
  /** Every priceable row in the bag, or null when the bag could not be read. */
  bag: readonly PriceableItem[] | null;
  /** Every owned hero, or null when the roster could not be read. */
  heroes: readonly PriceableHero[] | null;
  /** Every hero's worn `skin` index, or null when the roster could not be read. */
  skinsWorn: readonly number[] | null;
  snapshot: MarketSnapshot | null;
  currency?: string;
}

/**
 * A resolution with no key is something no market price could ever exist for — an item or hero the
 * game forbids selling, or a skin index the table cannot name — so it counts in neither the amount
 * nor the denominator. Everything else counts as eligible whether or not anything is listed today,
 * because the total is always of a subset and the coverage is what says so.
 */
function tally(resolved: readonly ResolvedPrice[]): HoldingsTally {
  let amount = 0;
  let priced = 0;
  let eligible = 0;
  for (const price of resolved) {
    if (price.key == null) continue;
    eligible += 1;
    if (price.state !== 'priced' || price.amount == null) continue;
    amount += price.amount;
    priced += 1;
  }
  return { amount, priced, eligible, withheld: false };
}

const withheldTally = (): HoldingsTally => ({
  amount: 0,
  priced: 0,
  eligible: 0,
  withheld: true,
});

/**
 * What the market says a whole account is worth: the bag, the sellable heroes, and the bought skins
 * those heroes are wearing, each with the count it covers.
 *
 * Pure and network-free, so every surface showing the figure computes it once and identically.
 */
export function accountHoldings({
  bag,
  heroes,
  skinsWorn,
  snapshot,
  currency = 'USD',
}: AccountHoldingsInput): AccountHoldings {
  const code = currency.toUpperCase();
  const parts: Record<HoldingComponent, HoldingsTally> = {
    bag: bag == null ? withheldTally() : tally(bag.map((it) => resolveItemPrice(it, snapshot, code))),
    heroes:
      heroes == null ? withheldTally() : tally(heroes.map((it) => resolveHeroPrice(it, snapshot, code))),
    skins:
      skinsWorn == null
        ? withheldTally()
        : tally(boughtSkinsWorn(skinsWorn).map((skin) => resolveSkinPrice(skin, snapshot, code))),
  };

  const sum = (read: (part: HoldingsTally) => number) =>
    HOLDING_COMPONENTS.reduce((running, component) => running + read(parts[component]), 0);
  const withheld = HOLDING_COMPONENTS.filter((component) => parts[component].withheld);

  return {
    currency: code,
    total: sum((part) => part.amount),
    priced: sum((part) => part.priced),
    eligible: sum((part) => part.eligible),
    bag: parts.bag,
    heroes: parts.heroes,
    skins: parts.skins,
    withheld,
    complete: withheld.length === 0,
  };
}
