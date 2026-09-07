import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_INVENTORY_SORT,
  EMPTY_INVENTORY_FILTER,
  buildInventoryView,
  type InventoryEntry,
  type InventorySort,
} from '@bombfarm/domain/inventory-view';
import {
  InventoryTable,
  nextInventorySort,
  type InventoryTableLabels,
  type InventoryTableProps,
} from './inventory-table';
import type { MarketPriceLabels, MarketPriceView } from './market-price';

const RAW_ITEMS = [
  { id: 'boots-3', def_id: 'coal_boots', category: 0, rarity: 3, level: 30, upgrade: 0, sell_value: 500 },
  { id: 'boots-5', def_id: 'coal_boots', category: 0, rarity: 5, level: 10, upgrade: 0, sell_value: 100 },
  { id: 'ring-2', def_id: 'iron_ring', category: 0, rarity: 2, level: 40, upgrade: 2, sell_value: 900 },
];

const NAMES: Record<string, string> = { coal_boots: 'Coal Boots', iron_ring: 'Iron Ring' };
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

const view = buildInventoryView(RAW_ITEMS);

const labels: InventoryTableLabels = {
  caption: 'Inventory',
  groupTitle: (kind) => kind,
  itemName: (item) => NAMES[item.defId] ?? item.defId,
  itemRarity: (item) => RARITIES[item.rarityIdx] ?? '',
  itemLevel: (item) => (item.level > 0 ? `Lv ${item.level}` : ''),
  itemForge: (item) => (item.upgrade > 0 ? `+${item.upgrade}` : ''),
  gold: (amount) => String(amount),
  searchText: (item) => NAMES[item.defId] ?? item.defId,
  column: {
    name: 'Item',
    forge: 'Forge',
    count: 'Qty',
    value: 'Gold',
    market: 'Steam',
    hero: 'Hero',
    actions: 'Actions',
  },
  rowAction: (itemName) => `Details for ${itemName}`,
  setOption: (group) => group.set,
  setOptionCount: (group) => String(group.count),
  toolbar: {
    searchPlaceholder: 'Search',
    searchLabel: 'Search items',
    allKinds: 'All kinds',
    rarity: (rarityIdx) => RARITIES[rarityIdx] ?? '',
    equippedOnly: 'Equipped',
    pricedOnly: 'Priced',
    clear: 'Clear filters',
    resultCount: (shown, total) => `${shown}/${total}`,
    noMatches: 'Nothing matches the filters',
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
  clear: 'Clear filters',
  filteredEmpty: {
    title: 'Nothing matches the filters',
    description: 'No item is left once the current filters are applied.',
  },
  empty: { title: 'No items' },
};

const priceLabels: MarketPriceLabels = {
  amount: (amount, currency) => `${currency} ${amount.toFixed(2)}`,
  title: (price) => `${price.basis} 1 h ago`,
  unpriced: (state) => (state === 'no-listing' ? 'No listing' : 'Unknown'),
};

const PRICES: Record<string, MarketPriceView> = {
  'boots-3': {
    state: 'priced',
    amount: 12.5,
    currency: 'USD',
    basis: 'native',
    listingUrl: null,
    quotedUtc: null,
    listings: 4,
  },
  'ring-2': {
    state: 'priced',
    amount: 3,
    currency: 'USD',
    basis: 'native',
    listingUrl: null,
    quotedUtc: null,
    listings: 2,
  },
  'boots-5': {
    state: 'no-listing',
    amount: null,
    currency: 'USD',
    basis: 'native',
    listingUrl: null,
    quotedUtc: null,
    listings: 0,
  },
};

const priceOf = (entry: InventoryEntry): MarketPriceView | null => PRICES[entry.key] ?? null;

function render(props: Partial<InventoryTableProps> = {}) {
  return renderToStaticMarkup(createElement(InventoryTable, { view, labels, ...props }));
}

function rowIds(html: string): string[] {
  return [...html.matchAll(/data-item-id="([^"]+)"/g)].map((match) => match[1]);
}

type HeadCell = { label: string; ariaSort: string | null; hasButton: boolean; body: string };

function headCells(html: string): HeadCell[] {
  const head = /<thead\b[^>]*>(.*?)<\/thead>/s.exec(html)?.[1] ?? '';
  return [...head.matchAll(/<th\b([^>]*)>(.*?)<\/th>/gs)].map(([, attributes, body]) => ({
    label: body.replace(/<[^>]*>/g, '').trim(),
    ariaSort: /aria-sort="([a-z]+)"/.exec(attributes)?.[1] ?? null,
    hasButton: body.includes('<button type="button"'),
    body,
  }));
}

function cellFor(html: string, label: string): HeadCell {
  const cell = headCells(html).find((candidate) => candidate.label === label);
  if (!cell) throw new Error(`no column header labelled ${label}`);
  return cell;
}

const byValue = (direction: 'asc' | 'desc'): InventorySort => [{ key: 'value', direction }];

describe('InventoryTable', () => {
  it('marks the leading sort column ascending or descending and every other one none', () => {
    const ascending = render({ sort: byValue('asc') });
    expect(cellFor(ascending, 'Gold').ariaSort).toBe('ascending');
    expect(cellFor(ascending, 'Qty').ariaSort).toBe('none');
    expect(cellFor(ascending, 'Item').ariaSort).toBe('none');

    const descending = render({ sort: byValue('desc') });
    expect(cellFor(descending, 'Gold').ariaSort).toBe('descending');
  });

  it('leaves the columns nothing can be ordered by without an aria-sort', () => {
    const html = render({ onSelectItem: () => {}, sort: byValue('asc') });
    expect(cellFor(html, 'Actions').ariaSort).toBeNull();
  });

  it('puts a real button inside every sortable header', () => {
    const html = render({ sort: byValue('asc') });
    for (const label of ['Item', 'Qty', 'Gold']) {
      expect(cellFor(html, label).hasButton).toBe(true);
    }
  });

  it('hides the direction glyph from assistive technology and keeps the column word beside it', () => {
    const cell = cellFor(render({ sort: byValue('asc') }), 'Gold');
    expect(cell.body).toContain('aria-hidden="true"');
    expect(cell.body).toContain('Gold');
  });

  it('reverses the rows when the column already leading the sort is picked again', () => {
    const sort = byValue('desc');
    expect(rowIds(render({ sort }))).toEqual(['ring-2', 'boots-3', 'boots-5']);

    const picked = nextInventorySort(sort, 'value');
    expect(picked[0]).toEqual({ key: 'value', direction: 'asc' });
    expect(rowIds(render({ sort: picked }))).toEqual(['boots-5', 'boots-3', 'ring-2']);
  });

  it('folds a newly picked column in front and keeps the previous one as the tie-break', () => {
    const picked = nextInventorySort(DEFAULT_INVENTORY_SORT, 'name');
    expect(picked).toEqual([
      { key: 'name', direction: 'asc' },
      { key: 'rarity', direction: 'desc' },
      { key: 'level', direction: 'desc' },
    ]);

    // Both boots are named the same, so only a surviving rarity term can separate them.
    expect(rowIds(render({ sort: picked }))).toEqual(['boots-5', 'boots-3', 'ring-2']);
  });

  it('sinks an entry the market has no price for to the bottom in both directions', () => {
    const priced = { priceOf, priceLabels };
    expect(rowIds(render({ ...priced, sort: [{ key: 'market', direction: 'asc' }] }))).toEqual([
      'ring-2',
      'boots-3',
      'boots-5',
    ]);
    expect(rowIds(render({ ...priced, sort: [{ key: 'market', direction: 'desc' }] }))).toEqual([
      'boots-3',
      'ring-2',
      'boots-5',
    ]);
  });

  it('drops the Steam column for a host that has no price data', () => {
    expect(headCells(render()).some((cell) => cell.label === 'Steam')).toBe(false);
    expect(headCells(render({ priceOf, priceLabels })).some((cell) => cell.label === 'Steam')).toBe(true);
  });

  it('names each row action after its own item rather than repeating one bare label', () => {
    const html = render({ onSelectItem: () => {} });
    expect(html).toContain('aria-label="Details for Coal Boots"');
    expect(html).toContain('aria-label="Details for Iron Ring"');
  });

  it('places the per-row price control beside the price it refreshes', () => {
    const html = render({
      priceOf,
      priceLabels,
      renderPriceAction: (entry) =>
        createElement(
          'button',
          { type: 'button', 'aria-label': `Refresh price for ${labels.itemName(entry.item)}` },
          '↻',
        ),
    });
    expect(html).toContain('aria-label="Refresh price for Coal Boots"');
  });

  it('sorts within a group rather than across the whole view', () => {
    const mixed = buildInventoryView([...RAW_ITEMS, { id: 'key-1', def_id: 'map_key_1', category: 4, rarity: 1 }]);
    const html = renderToStaticMarkup(
      createElement(InventoryTable, { view: mixed, labels, sort: [{ key: 'rarity', direction: 'asc' }] }),
    );
    expect(rowIds(html)).toEqual(['ring-2', 'boots-3', 'boots-5', 'map_key_1|1']);
  });

  it('says the filter is what emptied the list and offers to clear it', () => {
    const html = render({ filter: { ...EMPTY_INVENTORY_FILTER, text: 'nothing matches this' } });
    expect(html).toContain(labels.filteredEmpty.title);
    expect(html).toContain(labels.filteredEmpty.description);
    expect(html).toContain(labels.clear);
    expect(rowIds(html)).toEqual([]);
  });

  it('says only that the account holds nothing when no filter is involved', () => {
    const html = renderToStaticMarkup(
      createElement(InventoryTable, { view: buildInventoryView([]), labels }),
    );
    expect(html).toContain('No items');
    expect(html).not.toContain(labels.filteredEmpty.title);
  });
});

describe('InventoryTable toolbar', () => {
  it('keeps every control the cards have, the sort picker included', () => {
    const html = render();
    expect(html).toContain('Search');
    expect(html).toContain('All kinds');
    // Rarity and level are no longer columns to click, so the picker is the only way to reach
    // either order from the list layout.
    expect(html).toContain('Sort by');
  });

  it('is left out entirely for a host that narrows the view through a toolbar of its own', () => {
    const html = render({ showToolbar: false });
    expect(html).not.toContain('Search');
    expect(html).not.toContain('Sort by');
    expect(rowIds(html)).toHaveLength(3);
  });

  it('offers the priced narrowing only where the host can answer it', () => {
    expect(render()).not.toContain('Priced');
    expect(render({ isPricedItem: () => true })).toContain('Priced');
  });

  it('narrows to the priced rows through the host predicate', () => {
    const html = render({
      priceOf,
      priceLabels,
      isPricedItem: (item) => item.id === 'ring-2',
      filter: { ...EMPTY_INVENTORY_FILTER, pricedOnly: true },
    });
    expect(rowIds(html)).toEqual(['ring-2']);
  });
});

describe('InventoryTable columns', () => {
  it('says the tier and the level in the name cell instead of in columns of their own', () => {
    const html = render();
    expect(headCells(html).map((cell) => cell.label)).toEqual(['Item', 'Qty', 'Gold']);
    expect(html).toContain('Epic');
    expect(html).toContain('Lv 30');
  });

  it('draws the set a host asks for, in the order it asked for', () => {
    const html = render({ columns: ['name', 'forge', 'count'] });
    expect(headCells(html).map((cell) => cell.label)).toEqual(['Item', 'Forge', 'Qty']);
    expect(html).toContain('+2');
  });

  it('drops a column the host has no data for even when it asked for one', () => {
    expect(headCells(render({ columns: ['name', 'hero', 'market'] })).map((cell) => cell.label)).toEqual(['Item']);
  });

  it('marks the picked row and makes the whole row the control', () => {
    const html = render({ onSelectRow: () => {}, selectedItemId: 'ring-2' });
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('data-selected=""');
    expect(html).toContain('aria-label="Details for Iron Ring"');
  });
});

describe('InventoryTable virtualization', () => {
  const LONG_BAG = buildInventoryView(
    Array.from({ length: 300 }, (_, index) => ({
      id: `row-${String(index)}`,
      def_id: 'coal_boots',
      category: 0,
      rarity: 3,
      level: 30,
      upgrade: 0,
      sell_value: 100,
    })),
  );

  function spacerHeight(html: string, side: 'top' | 'bottom'): number {
    const spacer = new RegExp(
      String.raw`data-testid="inventory-table-spacer-${side}"[\s\S]*?style="height:(\d+)px`,
    ).exec(html);
    return spacer === null ? 0 : Number(spacer[1]);
  }

  it('mounts a fraction of a 300-row bag and holds the rest open with spacers', () => {
    const html = renderToStaticMarkup(createElement(InventoryTable, { view: LONG_BAG, labels }));
    const mounted = rowIds(html);

    expect(mounted.length).toBeGreaterThan(10);
    expect(mounted.length).toBeLessThan(40);
    // The first rows, in order — a window, not a sample.
    expect(mounted[0]).toBe('row-0');
    expect(mounted[1]).toBe('row-1');
  });

  it('keeps the scrollbar honest: spacers plus mounted rows are the whole bag\'s height', () => {
    const html = renderToStaticMarkup(createElement(InventoryTable, { view: LONG_BAG, labels }));
    const mounted = rowIds(html).length;
    const rowHeight = 46;

    expect(spacerHeight(html, 'top')).toBe(0);
    expect(spacerHeight(html, 'bottom') + mounted * rowHeight).toBe(300 * rowHeight);
  });
});
