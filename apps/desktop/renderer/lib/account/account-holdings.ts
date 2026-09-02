/**
 * What the market says the account could sell, from the one shared computation.
 *
 * Both the Account screen's holdings section and the Inventory screen's header come through here,
 * so the bag figure the two print is the same figure rather than two sums that agree by luck.
 */
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { AccountHoldings, MarketSnapshot } from '@bombfarm/pricing';
import { accountHoldings } from '@bombfarm/pricing';
import type { AccountHoldingsFacts } from './account-facts';

/** The currency the published market snapshot is quoted in — the same one the bag screen states. */
export const HOLDINGS_CURRENCY = 'BRL';

export function accountHoldingsFrom(
  facts: AccountHoldingsFacts,
  snapshot: MarketSnapshot | null,
): AccountHoldings {
  return accountHoldings({ ...facts, snapshot, currency: HOLDINGS_CURRENCY });
}

export interface BagTotals {
  /** Summed price of every bag item quoted right now. */
  total: number;
  priced: number;
  /** Items the game permits selling — the only ones that could ever carry a price. */
  tradable: number;
}

/**
 * The bag alone, taken from the account-wide computation with the other two components withheld.
 * `eligible` is what the game permits selling, which is what the header counts its coverage against.
 */
export function bagTotals(
  items: readonly InventoryViewItem[],
  snapshot: MarketSnapshot | null,
): BagTotals | null {
  if (snapshot == null) return null;
  const { bag } = accountHoldings({
    bag: items.map((item) => ({
      defId: item.defId,
      rarity: item.rarityIdx,
      tradable: item.tradable,
    })),
    heroes: null,
    skinsWorn: null,
    snapshot,
    currency: HOLDINGS_CURRENCY,
  });
  return { total: bag.amount, priced: bag.priced, tradable: bag.eligible };
}
