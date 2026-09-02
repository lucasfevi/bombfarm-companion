import type {
  HoldingsComponentId,
  HoldingsComponentView,
  HoldingsEntry,
  HoldingsLabels,
  HoldingsViewProps,
} from '@bombfarm/account/holdings';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { rarityLabel } from '@bombfarm/domain/game-labels';
import type { RarityKey } from '@bombfarm/domain/model';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type {
  AccountHoldings,
  HoldingsTally,
  MarketSnapshot,
  PriceableHero,
  PriceableItem,
  SkinsTally,
} from '@bombfarm/pricing';
import { accountHoldings, boughtSkinHashFor } from '@bombfarm/pricing';
import { formatMoney, sub, type Lang, type Strings } from '@/shared/i18n';
import type { StoredInventoryView } from '@/shared/lib/inventory-view-storage';

/** The currency the published market snapshot is quoted in — the one the Inventory screen states. */
export const HOLDINGS_CURRENCY = 'BRL';

/** A hero the market can price, carrying the name the holdings list prints it under. */
export interface HoldingsHero extends PriceableHero {
  name: string;
}

export interface AccountHoldingsSource {
  /** Every row of the stored inventory, or null when this browser has imported no save. */
  inventory: readonly InventoryViewItem[] | null;
  /** The roster as the market sees it, or null when no hero in it can answer for itself. */
  heroes: readonly HoldingsHero[] | null;
  /** Each hero's worn skin index, or null when there is no roster to read them off. */
  skinsWorn: readonly number[] | null;
  snapshot: MarketSnapshot | null;
}

const priceable = (item: InventoryViewItem): PriceableItem => ({
  defId: item.defId,
  rarity: item.rarityIdx,
  tradable: item.tradable,
});

/**
 * The roster as the market sees it, or null when not one hero in it can answer for itself.
 *
 * A hero carrying the game's `marketable` flag as `false` HAS answered: the account holds it and
 * the market will not list it, so it prices at nothing and belongs in no denominator. A roster
 * where no hero carries the flag at all is the other thing — heroes stored before the planner read
 * the flag, which nobody has asked yet — and only that withholds the whole component. Same shape
 * for a hero the planner built by hand, which the game has never seen and cannot sell.
 */
export function priceableHeroes(
  heroes: readonly { name: string; rarity: RarityKey; marketable?: boolean }[],
): HoldingsHero[] | null {
  if (!heroes.some((hero) => hero.marketable != null)) return null;
  return heroes.map((hero) => ({
    name: hero.name,
    rarity: RARITIES.indexOf(hero.rarity),
    marketable: hero.marketable ?? false,
  }));
}

/**
 * An account always has heroes, so an empty roster is a browser that has imported no save rather
 * than a player wearing no skins — and a zero would be the wrong answer to a question nobody can
 * answer yet.
 */
export function skinsWornBy(heroes: readonly { skin?: number }[]): number[] | null {
  return heroes.length === 0 ? null : heroes.map((hero) => hero.skin ?? 0);
}

/** An empty stored inventory is an empty inventory only once a save has actually written one. */
export function inventoryFromStorage(stored: StoredInventoryView): InventoryViewItem[] | null {
  return stored.importedAt === 0 ? null : stored.items;
}

export function accountHoldingsFrom({
  inventory,
  heroes,
  skinsWorn,
  snapshot,
}: AccountHoldingsSource): AccountHoldings {
  return accountHoldings({
    inventory: inventory == null ? null : inventory.map(priceable),
    heroes,
    skinsWorn,
    snapshot,
    currency: HOLDINGS_CURRENCY,
  });
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
 * One entry per hero the market could ever quote, carrying the rarity the quote is made on. A hero
 * the game forbids selling resolved with no key at all and belongs in no list; an eligible hero
 * nothing is listed for keeps its entry with a null amount, which is what makes the coverage line
 * above it investigable rather than a number to be taken on trust.
 */
function heroEntries(
  heroes: readonly HoldingsHero[] | null,
  tally: HoldingsTally,
  lang: Lang,
): HoldingsEntry[] {
  if (heroes == null) return [];
  const entries: HoldingsEntry[] = [];
  heroes.forEach((hero, position) => {
    const price = tally.prices[position];
    if (price == null || price.key == null) return;
    const rarity = RARITIES[hero.rarity];
    entries.push({
      name: hero.name,
      ...(rarity == null ? {} : { detail: rarityLabel(rarity, lang) }),
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
  lang: Lang,
): Pick<HoldingsViewProps, 'total' | 'currency' | 'inventory' | 'heroes' | 'skins'> {
  return {
    total: holdings.total,
    currency: holdings.currency,
    inventory: componentView(holdings.inventory, []),
    heroes: componentView(holdings.heroes, heroEntries(heroes, holdings.heroes, lang)),
    skins: componentView(holdings.skins, skinEntries(holdings.skins)),
  };
}

export function holdingsLabels(strings: Strings, lang: Lang): HoldingsLabels {
  const titles: Record<HoldingsComponentId, string> = {
    inventory: strings.accountHoldingsInventory,
    heroes: strings.accountHoldingsHeroes,
    skins: strings.accountHoldingsSkins,
  };
  const component = (componentId: HoldingsComponentId, coverage: string, withheld: string) => ({
    title: titles[componentId],
    coverage: (priced: number, eligible: number) => sub(coverage, { priced, eligible }),
    withheld,
  });

  return {
    total: strings.accountHoldingsTotal,
    partialTotal: strings.accountHoldingsPartialTotal,
    amount: (value, currency) => formatMoney(value, lang, currency),
    coverage: (priced, eligible) => sub(strings.accountHoldingsCoverage, { priced, eligible }),
    missing: (components) =>
      sub(strings.accountHoldingsMissing, {
        rows: components.map((componentId) => titles[componentId]).join(', '),
      }),
    components: {
      inventory: component(
        'inventory',
        strings.accountHoldingsInventoryCoverage,
        strings.accountHoldingsInventoryWithheld,
      ),
      heroes: component(
        'heroes',
        strings.accountHoldingsHeroesCoverage,
        strings.accountHoldingsHeroesWithheld,
      ),
      skins: component(
        'skins',
        strings.accountHoldingsSkinsCoverage,
        strings.accountHoldingsSkinsWithheld,
      ),
    },
    unpriced: strings.accountHoldingsUnpriced,
    heroesAreAFloor: strings.accountHoldingsHeroesFloor,
    skinsCountedWhileWorn: strings.accountHoldingsSkinsWorn,
  };
}
