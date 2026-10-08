// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement, useCallback, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DEFAULT_INVENTORY_SORT,
  EMPTY_INVENTORY_FILTER,
  buildInventoryView,
  type InventoryEntry,
  type InventorySort,
  type InventoryViewItem,
} from '@bombfarm/domain/inventory-view';
import {
  InventoryTable,
  nextInventorySort,
  type InventoryTableExtraColumn,
  type InventoryTableLabels,
  type InventoryTableProps,
} from './inventory-table';
import type { MarketPriceLabels, MarketPriceView } from './market-price';

const RAW_ITEMS = [
  { id: 'boots-3', def_id: 'coal_boots', category: 0, rarity: 3, level: 30, upgrade: 1 },
  { id: 'boots-5', def_id: 'coal_boots', category: 0, rarity: 5, level: 10, upgrade: 0 },
  { id: 'ring-2', def_id: 'iron_ring', category: 0, rarity: 2, level: 40, upgrade: 2 },
];

const NAMES: Record<string, string> = { coal_boots: 'Coal Boots', iron_ring: 'Iron Ring' };
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic'];

const view = buildInventoryView(RAW_ITEMS);

const labels: InventoryTableLabels = {
  lang: 'en',
  caption: 'Inventory',
  groupTitle: (kind) => kind,
  itemName: (item) => NAMES[item.defId] ?? item.defId,
  itemRarity: (item) => RARITIES[item.rarityIdx] ?? '',
  itemLevel: (item) => (item.level > 0 ? `Lv ${item.level}` : ''),
  itemForge: (item) => (item.upgrade > 0 ? `+${item.upgrade}` : ''),
  searchText: (item) => NAMES[item.defId] ?? item.defId,
  column: {
    name: 'Item',
    forge: 'Forge',
    count: 'Qty',
    market: 'Steam',
    hero: 'Hero',
    actions: 'Actions',
  },
  rowAction: (itemName) => `Details for ${itemName}`,
  selectRow: (itemName) => `Pick ${itemName}`,
  selectColumn: 'Picked',
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

const SORTABLE_COLUMNS = ['name', 'count', 'forge', 'market', 'hero', 'actions'] as const;

function render(props: Partial<InventoryTableProps> = {}) {
  return renderToStaticMarkup(createElement(InventoryTable, { view, labels, columns: SORTABLE_COLUMNS, ...props }));
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

const byForge = (direction: 'asc' | 'desc'): InventorySort => [{ key: 'forge', direction }];

describe('InventoryTable', () => {
  it('marks the leading sort column ascending or descending and every other one none', () => {
    const ascending = render({ sort: byForge('asc') });
    expect(cellFor(ascending, 'Forge').ariaSort).toBe('ascending');
    expect(cellFor(ascending, 'Qty').ariaSort).toBe('none');
    expect(cellFor(ascending, 'Item').ariaSort).toBe('none');

    const descending = render({ sort: byForge('desc') });
    expect(cellFor(descending, 'Forge').ariaSort).toBe('descending');
  });

  it('leaves the columns nothing can be ordered by without an aria-sort', () => {
    const html = render({ onSelectItem: () => {}, sort: byForge('asc') });
    expect(cellFor(html, 'Actions').ariaSort).toBeNull();
  });

  it('puts a real button inside every sortable header', () => {
    const html = render({ sort: byForge('asc') });
    for (const label of ['Item', 'Qty', 'Forge']) {
      expect(cellFor(html, label).hasButton).toBe(true);
    }
  });

  it('hides the direction glyph from assistive technology and keeps the column word beside it', () => {
    const cell = cellFor(render({ sort: byForge('asc') }), 'Forge');
    expect(cell.body).toContain('aria-hidden="true"');
    expect(cell.body).toContain('Forge');
  });

  it('reverses the rows when the column already leading the sort is picked again', () => {
    const sort = byForge('desc');
    expect(rowIds(render({ sort }))).toEqual(['ring-2', 'boots-3', 'boots-5']);

    const picked = nextInventorySort(sort, 'forge');
    expect(picked[0]).toEqual({ key: 'forge', direction: 'asc' });
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
    expect(headCells(html).map((cell) => cell.label)).toEqual(['Item', 'Qty', 'Forge']);
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

// react-dom/client warns that act() is unsupported unless this is set — there is no testing
// library here to do it.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function tableMarkup(props: Partial<InventoryTableProps> = {}) {
  return render({ showToolbar: false, ...props });
}

describe('InventoryTable checklist', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.matchMedia = ((media: string) => ({
      matches: false,
      media,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    container = document.createElement('div');
    document.body.append(container);
    act(() => {
      root = createRoot(container);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  function mount(node: ReactNode) {
    act(() => {
      root.render(node);
    });
  }

  function table(props: Partial<InventoryTableProps> = {}) {
    return createElement(InventoryTable, { view, labels, columns: SORTABLE_COLUMNS, showToolbar: false, ...props });
  }

  function rowFor(id: string): HTMLElement {
    const row = container.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
    if (!row) throw new Error(`no row for ${id}`);
    return row;
  }

  function checkboxFor(id: string): HTMLElement {
    const box = rowFor(id).querySelector<HTMLElement>('[role="checkbox"]');
    if (!box) throw new Error(`no checkbox in row ${id}`);
    return box;
  }

  function cellOf(id: string, index: number): HTMLElement {
    const cell = rowFor(id).querySelectorAll<HTMLElement>('td, th')[index];
    if (!cell) throw new Error(`no cell ${String(index)} in row ${id}`);
    return cell;
  }

  function press(target: HTMLElement) {
    act(() => {
      target.click();
    });
  }

  function key(target: HTMLElement, type: 'keydown' | 'keyup', name: string) {
    act(() => {
      target.dispatchEvent(new KeyboardEvent(type, { key: name, bubbles: true, cancelable: true }));
    });
  }

  function headerCell(label: string): Element | undefined {
    return [...container.querySelectorAll('thead th')].find((th) => th.textContent.trim() === label);
  }

  function headerButton(label: string): HTMLButtonElement {
    const button = headerCell(label)?.querySelector('button');
    if (!button) throw new Error(`no sortable header labelled ${label}`);
    return button;
  }

  function renderedIds(): string[] {
    return [...container.querySelectorAll<HTMLElement>('[data-item-id]')].map((row) => row.dataset.itemId ?? '');
  }

  function toggledIds(onToggleRow: ReturnType<typeof vi.fn>): string[] {
    return onToggleRow.mock.calls.map(([item]) => (item as InventoryViewItem).id);
  }

  it('draws a checkbox column only for a host that supplies onToggleRow', () => {
    const plain = tableMarkup({ onSelectRow: () => {} });
    expect(plain).not.toContain('role="checkbox"');
    expect(headCells(plain).map((cell) => cell.label)).toEqual(['Item', 'Qty', 'Forge']);

    const checklist = tableMarkup({ onToggleRow: () => {} });
    expect(checklist.match(/role="checkbox"/g)).toHaveLength(3);
    expect(headCells(checklist).map((cell) => cell.label)).toEqual(['Picked', 'Item', 'Qty', 'Forge']);
  });

  it('leaves the header cell over the checkboxes without a control, named for assistive technology', () => {
    const header = headCells(tableMarkup({ onToggleRow: () => {} }))[0];
    expect(header.body).not.toContain('role="checkbox"');
    expect(header.body).not.toContain('<button');
    expect(header.body).toContain('sr-only');
    expect(header.label).toBe('Picked');
  });

  it('names each checkbox after its own item', () => {
    const html = tableMarkup({ onToggleRow: () => {} });
    expect(html).toContain('aria-label="Pick Coal Boots"');
    expect(html).toContain('aria-label="Pick Iron Ring"');
  });

  it('falls back to the bare item name when the host supplies no checkbox label', () => {
    const html = tableMarkup({
      onToggleRow: () => {},
      labels: { ...labels, selectRow: undefined, selectColumn: undefined },
    });
    expect(html).toContain('aria-label="Iron Ring"');
  });

  it('takes the checked state and aria-selected from selectedItemIds', () => {
    mount(table({ onToggleRow: () => {}, selectedItemIds: new Set(['ring-2']) }));

    expect(checkboxFor('ring-2').getAttribute('aria-checked')).toBe('true');
    expect(checkboxFor('boots-3').getAttribute('aria-checked')).toBe('false');
    expect(rowFor('ring-2').getAttribute('aria-selected')).toBe('true');
    expect(rowFor('boots-3').getAttribute('aria-selected')).toBe('false');
    expect(rowFor('ring-2').hasAttribute('data-selected')).toBe(true);
  });

  it('calls onToggleRow with the item when the row is pressed', () => {
    const onToggleRow = vi.fn();
    mount(table({ onToggleRow }));

    press(cellOf('boots-5', 2));

    expect(toggledIds(onToggleRow)).toEqual(['boots-5']);
  });

  it('toggles once, not twice, when the checkbox itself is pressed', () => {
    const onToggleRow = vi.fn();
    mount(table({ onToggleRow }));

    press(checkboxFor('ring-2'));

    expect(toggledIds(onToggleRow)).toEqual(['ring-2']);
  });

  it('toggles from the keyboard with Space and with Enter on the checkbox', () => {
    const onToggleRow = vi.fn();
    mount(table({ onToggleRow }));
    const box = checkboxFor('boots-3');

    key(box, 'keydown', ' ');
    key(box, 'keyup', ' ');
    expect(toggledIds(onToggleRow)).toEqual(['boots-3']);

    key(box, 'keydown', 'Enter');
    key(box, 'keyup', 'Enter');
    expect(toggledIds(onToggleRow)).toEqual(['boots-3', 'boots-3']);
  });

  it('does not turn the item name into a button when the row itself is the control', () => {
    mount(table({ onToggleRow: () => {} }));
    expect(rowFor('ring-2').querySelector('th button')).toBeNull();
  });

  describe('a row with a reason it cannot be picked', () => {
    const rowDisabledReason = (item: InventoryViewItem) => (item.id === 'ring-2' ? 'Equipped by a hero' : null);

    it('dims the row, disables the checkbox and keeps the reason readable', () => {
      mount(table({ onToggleRow: () => {}, rowDisabledReason }));

      const row = rowFor('ring-2');
      const box = checkboxFor('ring-2');
      expect(row.hasAttribute('data-disabled')).toBe(true);
      expect(row.getAttribute('aria-disabled')).toBe('true');
      expect(box.hasAttribute('data-disabled')).toBe(true);
      expect(row.querySelector<HTMLInputElement>('input[type="checkbox"]')?.disabled).toBe(true);

      const reasonId = box.getAttribute('aria-describedby');
      expect(reasonId).toBeTruthy();
      expect(document.getElementById(reasonId ?? '')?.textContent).toBe('Equipped by a hero');

      expect(rowFor('boots-3').hasAttribute('data-disabled')).toBe(false);
      expect(checkboxFor('boots-3').getAttribute('aria-describedby')).toBeNull();
    });

    it('never calls onToggleRow for it, whether the row, the checkbox or the keyboard is used', () => {
      const onToggleRow = vi.fn();
      mount(table({ onToggleRow, rowDisabledReason }));
      const box = checkboxFor('ring-2');

      press(cellOf('ring-2', 2));
      press(box);
      key(box, 'keydown', ' ');
      key(box, 'keyup', ' ');
      key(box, 'keydown', 'Enter');

      expect(onToggleRow).not.toHaveBeenCalled();

      press(checkboxFor('boots-3'));
      expect(toggledIds(onToggleRow)).toEqual(['boots-3']);
    });

    it('keeps the reason in the markup of the first paint', () => {
      const html = tableMarkup({ onToggleRow: () => {}, rowDisabledReason });
      expect(html).toContain('Equipped by a hero');
      expect(html).toContain('aria-disabled="true"');
    });
  });

  it('re-renders only the row that was toggled', () => {
    const equippedBy = vi.fn(() => null);
    const counting = { ...labels, equippedBy };
    const columns = ['name', 'count'] as const;

    function Host() {
      const [picked, setPicked] = useState<ReadonlySet<string>>(new Set());
      const onToggleRow = useCallback((item: InventoryViewItem) => {
        setPicked((current) => {
          const next = new Set(current);
          if (!next.delete(item.id)) next.add(item.id);
          return next;
        });
      }, []);
      return createElement(InventoryTable, {
        view,
        labels: counting,
        columns,
        showToolbar: false,
        onToggleRow,
        selectedItemIds: picked,
      });
    }

    mount(createElement(Host));
    expect(equippedBy).toHaveBeenCalledTimes(3);

    equippedBy.mockClear();
    press(checkboxFor('boots-3'));

    expect(checkboxFor('boots-3').getAttribute('aria-checked')).toBe('true');
    expect(equippedBy).toHaveBeenCalledTimes(1);
  });

  describe('extra column', () => {
    const levelColumn: InventoryTableExtraColumn = {
      id: 'level',
      header: 'Level',
      align: 'end',
      width: '5rem',
      numeric: true,
      sortValue: (item) => item.level,
      render: (item) => `L${String(item.level)}`,
    };

    const sortAttr = (label: string) => headerCell(label)?.getAttribute('aria-sort');

    it('draws the host header and cell for every row, ahead of the actions column by default', () => {
      const html = tableMarkup({ extraColumn: levelColumn, onSelectItem: () => {} });
      expect(headCells(html).map((cell) => cell.label)).toEqual(['Item', 'Qty', 'Forge', 'Level', 'Actions']);
      expect(html).toContain('L30');
      expect(html).toContain('L10');
      expect(html).toContain('L40');
      expect(html).toContain('<col data-column="extra" style="width:5rem"');
    });

    it('sits behind the column the host names', () => {
      const html = tableMarkup({ extraColumn: { ...levelColumn, after: 'name' } });
      expect(headCells(html).map((cell) => cell.label)).toEqual(['Item', 'Level', 'Qty', 'Forge']);
    });

    it('draws a plain header when the host gives it nothing to sort by', () => {
      const html = tableMarkup({ extraColumn: { ...levelColumn, sortValue: undefined } });
      expect(cellFor(html, 'Level').hasButton).toBe(false);
      expect(cellFor(html, 'Level').ariaSort).toBeNull();
    });

    it('orders by it largest first, then smallest first, when its header is picked', () => {
      mount(table({ extraColumn: levelColumn }));
      expect(renderedIds()).toEqual(['boots-5', 'boots-3', 'ring-2']);
      expect(sortAttr('Level')).toBe('none');

      press(headerButton('Level'));
      expect(renderedIds()).toEqual(['ring-2', 'boots-3', 'boots-5']);
      expect(sortAttr('Level')).toBe('descending');
      expect(sortAttr('Item')).toBe('none');

      press(headerButton('Level'));
      expect(renderedIds()).toEqual(['boots-5', 'boots-3', 'ring-2']);
      expect(sortAttr('Level')).toBe('ascending');
    });

    it('keeps the sort the host owns as the tie-break underneath', () => {
      mount(table({ extraColumn: { ...levelColumn, sortValue: () => 0 } }));
      press(headerButton('Level'));
      expect(renderedIds()).toEqual(['boots-5', 'boots-3', 'ring-2']);
    });

    it('gives way to a built-in column the moment one is picked', () => {
      mount(table({ extraColumn: levelColumn }));
      press(headerButton('Level'));

      press(headerButton('Forge'));

      expect(sortAttr('Level')).toBe('none');
      expect(sortAttr('Forge')).toBe('descending');
      expect(renderedIds()).toEqual(['ring-2', 'boots-3', 'boots-5']);
    });

    it('draws the order the host holds and only reports a header pick, keeping none of its own', () => {
      const onExtraSortChange = vi.fn();
      mount(table({ extraColumn: levelColumn, extraSort: 'desc', onExtraSortChange }));
      expect(renderedIds()).toEqual(['ring-2', 'boots-3', 'boots-5']);
      expect(sortAttr('Level')).toBe('descending');

      press(headerButton('Level'));
      expect(onExtraSortChange).toHaveBeenLastCalledWith('asc');
      expect(renderedIds()).toEqual(['ring-2', 'boots-3', 'boots-5']);

      mount(table({ extraColumn: levelColumn, extraSort: 'asc', onExtraSortChange }));
      expect(renderedIds()).toEqual(['boots-5', 'boots-3', 'ring-2']);
      expect(sortAttr('Level')).toBe('ascending');

      press(headerButton('Level'));
      expect(onExtraSortChange).toHaveBeenLastCalledWith('desc');
    });

    it('starts a controlled order largest first, and is rid of it when a built-in header is picked', () => {
      const onExtraSortChange = vi.fn();
      mount(table({ extraColumn: levelColumn, extraSort: null, onExtraSortChange }));
      expect(sortAttr('Level')).toBe('none');
      press(headerButton('Level'));
      expect(onExtraSortChange).toHaveBeenLastCalledWith('desc');

      mount(table({ extraColumn: levelColumn, extraSort: 'desc', onExtraSortChange }));
      press(headerButton('Forge'));
      expect(onExtraSortChange).toHaveBeenLastCalledWith(null);
    });

    it('lets go of its order when the host moves the sort it owns', () => {
      mount(table({ extraColumn: levelColumn, sort: byForge('desc'), onSortChange: () => {} }));
      press(headerButton('Level'));
      expect(sortAttr('Level')).toBe('descending');

      mount(table({ extraColumn: levelColumn, sort: byForge('asc'), onSortChange: () => {} }));

      expect(sortAttr('Level')).toBe('none');
      expect(renderedIds()).toEqual(['boots-5', 'boots-3', 'ring-2']);
    });
  });

  it('still makes the whole row a single-select control, with no checkbox, for a host that uses onSelectRow', () => {
    const onSelectRow = vi.fn();
    mount(table({ onSelectRow, selectedItemId: 'ring-2' }));

    expect(container.querySelector('[role="checkbox"]')).toBeNull();
    expect(rowFor('ring-2').getAttribute('aria-selected')).toBe('true');

    press(cellOf('boots-3', 1));

    expect(toggledIds(onSelectRow)).toEqual(['boots-3']);
  });
});
