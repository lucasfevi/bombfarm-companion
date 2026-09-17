import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildInventoryView } from '@bombfarm/domain/inventory-view';
import { InventoryGrid, type InventoryGridLabels } from './inventory-grid';

const STAT_NAMES: Record<string, string> = {
  dmg: 'Damage',
  energia: 'Energy',
  velocidade: 'Speed',
  sorte: 'Luck',
  crit: 'Crit Chance',
  penetracao: 'Penetration',
  cooldown: 'Cooldown',
};

const labels: InventoryGridLabels = {
  lang: 'en',
  groupTitle: (kind) => kind,
  itemName: (item) => item.defId,
  itemRarity: (item) => `Rarity ${item.rarityIdx}`,
  itemLevel: (item) => `Lv ${item.level}`,
  itemForge: (item) => (item.upgrade > 0 ? `+${item.upgrade}` : ''),
  itemStat: (stat) => ({ label: STAT_NAMES[stat.name ?? ''] ?? String(stat.code), value: `+${stat.effective}` }),
  badges: () => [],
  setOption: (group) => group.set,
  setOptionCount: (group) => String(group.count),
  gold: (amount) => String(amount),
  searchText: (item) => item.defId,
  toolbar: {
    searchPlaceholder: 'Search',
    searchLabel: 'Search items',
    allKinds: 'All kinds',
    rarity: (rarityIdx) => `Rarity ${rarityIdx}`,
    equippedOnly: 'Equipped',
    pricedOnly: 'Priced',
    clear: 'Clear filters',
    resultCount: (shown, total) => `${shown}/${total}`,
    noMatches: 'Nothing matches',
    heroLabel: 'Hero',
    allHeroes: 'All heroes',
    setsLabel: 'Sets',
    allSets: 'All sets',
    setsOwned: 'Sets you own',
    setsSelected: (chosen, total) => `${chosen}/${total} sets`,
    selectAllSets: 'Select all',
    sortLabel: 'Sort by',
    sortKey: (key) => key,
    sortAscending: 'Ascending',
    sortDescending: 'Descending',
  },
  empty: { title: 'No items' },
};

const mythicAmulet = { id: 'amulet-1', def_id: 'forest_amuleto', category: 0, rarity: 5, level: 40, upgrade: 12, sell_value: 2500 };

/** The card's own stat block, which is the part the hover card must agree with. */
function cardStatLabels(html: string): string[] {
  const card = /data-testid="inventory-card"(.*?)data-testid="inventory-card-footer"/s.exec(html)?.[1] ?? '';
  return [...card.matchAll(/class="shrink-0 truncate font-semibold text-ink">([^<]+)</g)].map((match) => match[1]);
}

describe('InventoryGrid', () => {
  it('prints every roll a Mythic makes — six, not the four a cap once allowed', () => {
    const html = renderToStaticMarkup(createElement(InventoryGrid, { view: buildInventoryView([mythicAmulet]), labels }));
    expect(cardStatLabels(html)).toEqual(['Luck', 'Damage', 'Crit Chance', 'Penetration', 'Cooldown', 'Speed']);
  });
});
