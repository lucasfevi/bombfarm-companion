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
import { InventoryTable, nextInventorySort, type InventoryTableLabels, type InventoryTableProps } from './inventory-table';
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
  itemForge: (item) => (item.upgrade > 0 ? `+${item.upgrade}` : ''),
  gold: (amount) => String(amount),
  searchText: (item) => NAMES[item.defId] ?? item.defId,
  column: {
    name: 'Item',
    rarity: 'Rarity',
    level: 'Level',
    count: 'Qty',
    value: 'Gold',
    market: 'Steam',
    equippedBy: 'Hero',
    actions: 'Actions',
  },
  rowAction: (itemName) => `Details for ${itemName}`,
  searchPlaceholder: 'Search',
  searchLabel: 'Search items',
  resultCount: (shown, total) => `${shown}/${total}`,
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
    expect(cellFor(ascending, 'Level').ariaSort).toBe('none');
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
    for (const label of ['Item', 'Rarity', 'Level', 'Qty', 'Gold']) {
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
