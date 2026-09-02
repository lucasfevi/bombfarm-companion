/**
 * What the market says the account could sell, from the one shared computation.
 *
 * Both the Account screen's holdings section and the Inventory screen's header come through here,
 * so the inventory figure the two print is the same figure rather than two sums that agree by luck.
 */
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { HeroIdentity } from '@bombfarm/game-art';
import type { DomainLang } from '@bombfarm/contracts';
import type {
  HoldingsComponentView,
  HoldingsEntry,
  HoldingsViewProps,
} from '@bombfarm/account/holdings';
import type { AccountHoldings, HoldingsTally, MarketSnapshot, SkinsTally } from '@bombfarm/pricing';
import { accountHoldings, boughtSkinHashFor } from '@bombfarm/pricing';
import type { AccountHoldingsFacts, HoldingsHero } from './account-facts';

/** The currency the published market snapshot is quoted in — the one the Inventory screen states. */
export const HOLDINGS_CURRENCY = 'BRL';

export function accountHoldingsFrom(
  facts: AccountHoldingsFacts,
  snapshot: MarketSnapshot | null,
): AccountHoldings {
  return accountHoldings({ ...facts, snapshot, currency: HOLDINGS_CURRENCY });
}

const componentView = (
  tally: HoldingsTally,
  entries: readonly HoldingsEntry[],
): HoldingsComponentView => ({
  amount: tally.amount,
  priced: tally.priced,
  eligible: tally.eligible,
  withheld: tally.withheld,
  entries,
});

/**
 * One entry per hero the market could ever quote, depicted the way every other screen depicts a
 * hero — avatar, rank, name, rarity, level. A hero the game forbids selling resolved with no key at
 * all and belongs in no list; an eligible hero nothing is listed for keeps its entry with a null
 * amount, which is what makes the coverage line above it investigable rather than a number to be
 * taken on trust.
 *
 * The identity block is built here rather than in the shared view because it needs a language, and
 * that view has none. A roster row the game served without a rank or a level leaves the field out
 * and lets the block show what it does know.
 */
function heroEntries(
  heroes: readonly HoldingsHero[] | null,
  tally: HoldingsTally,
  lang: DomainLang,
): HoldingsEntry[] {
  if (heroes == null) return [];
  const entries: HoldingsEntry[] = [];
  heroes.forEach((hero, position) => {
    const price = tally.prices[position];
    if (price == null || price.key == null) return;
    entries.push({
      name: hero.name,
      leading: (
        <HeroIdentity
          name={hero.name}
          rank={hero.rank}
          rarityIdx={hero.rarity}
          stars={hero.stars}
          level={hero.level}
          skin={hero.skin}
          lang={lang}
          size="xs"
          variant="stacked"
        />
      ),
      amount: price.amount,
    });
  });
  return entries;
}

/**
 * One entry per distinct bought skin, named by the market listing it appears under. A skin index
 * the table cannot name has no name to print and no price to print either, so it is left out.
 */
function skinEntries(skins: SkinsTally): HoldingsEntry[] {
  const entries: HoldingsEntry[] = [];
  skins.skinIndexes.forEach((skinIndex, position) => {
    const price = skins.prices[position];
    const name = boughtSkinHashFor(skinIndex);
    if (price == null || name == null) return;
    entries.push({ name, amount: price.amount });
  });
  return entries;
}

/**
 * The three columns the holdings section draws, each over what its figure is made of.
 *
 * The inventory column lists nothing: it holds dozens of rows, more than a column can carry, and
 * the Inventory screen its link leads to is what lists them.
 */
export function holdingsComponents(
  holdings: AccountHoldings,
  heroes: readonly HoldingsHero[] | null,
  lang: DomainLang,
): Pick<HoldingsViewProps, 'total' | 'currency' | 'inventory' | 'heroes' | 'skins'> {
  return {
    total: holdings.total,
    currency: holdings.currency,
    inventory: componentView(holdings.inventory, []),
    heroes: componentView(holdings.heroes, heroEntries(heroes, holdings.heroes, lang)),
    skins: componentView(holdings.skins, skinEntries(holdings.skins)),
  };
}

export interface InventoryTotals {
  /** Summed price of every inventory item quoted right now. */
  total: number;
  priced: number;
  /** Items the game permits selling — the only ones that could ever carry a price. */
  tradable: number;
}

/**
 * The inventory alone, taken from the account-wide computation with the other two components
 * withheld. `eligible` is what the game permits selling, which is what the header counts its
 * coverage against.
 */
export function inventoryTotals(
  items: readonly InventoryViewItem[],
  snapshot: MarketSnapshot | null,
): InventoryTotals | null {
  if (snapshot == null) return null;
  const { inventory } = accountHoldings({
    inventory: items.map((item) => ({
      defId: item.defId,
      rarity: item.rarityIdx,
      tradable: item.tradable,
    })),
    heroes: null,
    skinsWorn: null,
    snapshot,
    currency: HOLDINGS_CURRENCY,
  });
  return { total: inventory.amount, priced: inventory.priced, tradable: inventory.eligible };
}
