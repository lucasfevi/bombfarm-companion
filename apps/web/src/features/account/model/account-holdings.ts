import type { HoldingsLabels, HoldingsRowId, HoldingsViewProps } from '@bombfarm/account/holdings';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { RarityKey } from '@bombfarm/domain/model';
import { RARITIES } from '@bombfarm/domain/planner-constants';
import type {
  AccountHoldings,
  MarketSnapshot,
  PriceableHero,
  PriceableItem,
} from '@bombfarm/pricing';
import { accountHoldings } from '@bombfarm/pricing';
import { formatMoney, sub, type Lang, type Strings } from '@/shared/i18n';
import type { StoredInventoryView } from '@/shared/lib/inventory-view-storage';

/** The currency the published market snapshot is quoted in — the same one the bag screen states. */
export const HOLDINGS_CURRENCY = 'BRL';

export interface AccountHoldingsSource {
  /** Every row of the stored bag, or null when no save has been imported into this browser. */
  bag: readonly InventoryViewItem[] | null;
  /** The roster as the market sees it, or null when no hero in it can answer for itself. */
  heroes: readonly PriceableHero[] | null;
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
  heroes: readonly { rarity: RarityKey; marketable?: boolean }[],
): PriceableHero[] | null {
  if (!heroes.some((hero) => hero.marketable != null)) return null;
  return heroes.map((hero) => ({
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

/** An empty stored bag is an empty bag only once a save has actually written one. */
export function bagFromStorage(stored: StoredInventoryView): InventoryViewItem[] | null {
  return stored.importedAt === 0 ? null : stored.items;
}

export function accountHoldingsFrom({
  bag,
  heroes,
  skinsWorn,
  snapshot,
}: AccountHoldingsSource): AccountHoldings {
  return accountHoldings({
    bag: bag == null ? null : bag.map(priceable),
    heroes,
    skinsWorn,
    snapshot,
    currency: HOLDINGS_CURRENCY,
  });
}

export function holdingsRows(
  holdings: AccountHoldings,
): Pick<HoldingsViewProps, 'total' | 'currency' | 'bag' | 'heroes' | 'skins'> {
  return {
    total: holdings.total,
    currency: holdings.currency,
    bag: holdings.bag,
    heroes: holdings.heroes,
    skins: holdings.skins,
  };
}

export function holdingsLabels(strings: Strings, lang: Lang): HoldingsLabels {
  const titles: Record<HoldingsRowId, string> = {
    bag: strings.accountHoldingsBag,
    heroes: strings.accountHoldingsHeroes,
    skins: strings.accountHoldingsSkins,
  };
  const row = (rowId: HoldingsRowId, coverage: string, withheld: string) => ({
    title: titles[rowId],
    coverage: (priced: number, eligible: number) => sub(coverage, { priced, eligible }),
    withheld,
  });

  return {
    total: strings.accountHoldingsTotal,
    partialTotal: strings.accountHoldingsPartialTotal,
    amount: (value, currency) => formatMoney(value, lang, currency),
    coverage: (priced, eligible) => sub(strings.accountHoldingsCoverage, { priced, eligible }),
    missing: (rows) =>
      sub(strings.accountHoldingsMissing, { rows: rows.map((rowId) => titles[rowId]).join(', ') }),
    rows: {
      bag: row('bag', strings.accountHoldingsBagCoverage, strings.accountHoldingsBagWithheld),
      heroes: row(
        'heroes',
        strings.accountHoldingsHeroesCoverage,
        strings.accountHoldingsHeroesWithheld,
      ),
      skins: row(
        'skins',
        strings.accountHoldingsSkinsCoverage,
        strings.accountHoldingsSkinsWithheld,
      ),
    },
    heroesAreAFloor: strings.accountHoldingsHeroesFloor,
    skinsCountedWhileWorn: strings.accountHoldingsSkinsWorn,
  };
}
