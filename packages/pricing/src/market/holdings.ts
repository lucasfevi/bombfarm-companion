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

export const HOLDING_COMPONENTS = ['inventory', 'heroes', 'skins'] as const;
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
  /**
   * What the market said about each thing this component holds — one per thing given, in the order
   * it was given, so a caller can name the source of a price without resolving anything a second
   * time. Empty for a withheld component.
   */
  prices: ResolvedPrice[];
}

/**
 * Skins are the one component priced over a list the caller never handed in: the input is per hero,
 * and one purchase dresses any number of them, so the prices are per distinct bought skin.
 * `skinIndexes` is that list, in the order `prices` follows.
 */
export interface SkinsTally extends HoldingsTally {
  skinIndexes: number[];
}

export interface AccountHoldings {
  /** The currency asked for, upper-cased. */
  currency: string;
  /** `inventory`, `heroes` and `skins` summed. */
  total: number;
  priced: number;
  eligible: number;
  inventory: HoldingsTally;
  heroes: HoldingsTally;
  skins: SkinsTally;
  /**
   * The components whose account data the caller could not supply. A non-empty list means `total`
   * covers only part of the account and must not be shown as what the account is worth.
   */
  withheld: HoldingComponent[];
  /** True only when nothing was withheld, so `total` spans the whole account. */
  complete: boolean;
}

export interface AccountHoldingsInput {
  /** Every priceable row in the inventory, or null when the inventory could not be read. */
  inventory: readonly PriceableItem[] | null;
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
function tally(prices: ResolvedPrice[]): HoldingsTally {
  let amount = 0;
  let priced = 0;
  let eligible = 0;
  for (const price of prices) {
    if (price.key == null) continue;
    eligible += 1;
    if (price.state !== 'priced' || price.amount == null) continue;
    amount += price.amount;
    priced += 1;
  }
  return { amount, priced, eligible, withheld: false, prices };
}

const withheldTally = (): HoldingsTally => ({
  amount: 0,
  priced: 0,
  eligible: 0,
  withheld: true,
  prices: [],
});

/**
 * What the market says a whole account is worth: the inventory, the sellable heroes, and the bought
 * skins those heroes are wearing, each with the count it covers and what it said about every piece.
 *
 * Pure and network-free, so every surface showing the figure computes it once and identically.
 */
export function accountHoldings({
  inventory,
  heroes,
  skinsWorn,
  snapshot,
  currency = 'USD',
}: AccountHoldingsInput): AccountHoldings {
  const code = currency.toUpperCase();
  const bought = skinsWorn == null ? null : boughtSkinsWorn(skinsWorn);
  const parts: Record<HoldingComponent, HoldingsTally> & { skins: SkinsTally } = {
    inventory:
      inventory == null
        ? withheldTally()
        : tally(inventory.map((item) => resolveItemPrice(item, snapshot, code))),
    heroes:
      heroes == null
        ? withheldTally()
        : tally(heroes.map((hero) => resolveHeroPrice(hero, snapshot, code))),
    skins:
      bought == null
        ? { ...withheldTally(), skinIndexes: [] }
        : {
            ...tally(bought.map((skin) => resolveSkinPrice(skin, snapshot, code))),
            skinIndexes: bought,
          },
  };

  const sum = (read: (part: HoldingsTally) => number) =>
    HOLDING_COMPONENTS.reduce((running, component) => running + read(parts[component]), 0);
  const withheld = HOLDING_COMPONENTS.filter((component) => parts[component].withheld);

  return {
    currency: code,
    total: sum((part) => part.amount),
    priced: sum((part) => part.priced),
    eligible: sum((part) => part.eligible),
    inventory: parts.inventory,
    heroes: parts.heroes,
    skins: parts.skins,
    withheld,
    complete: withheld.length === 0,
  };
}
