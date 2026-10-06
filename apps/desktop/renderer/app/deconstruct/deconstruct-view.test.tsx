// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AccountSource, AccountView, DeconstructEvent } from '@bombfarm/contracts';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { EMPTY_DECONSTRUCT_FILTER } from '../../lib/deconstruct/deconstruct-rows';
import { dismissDeconstructRun } from '../../lib/deconstruct/deconstruct-run-store';
import {
  DEFAULT_DECONSTRUCT_SORT,
  deconstructSelection,
  setDeconstructEssenceSort,
  setDeconstructFilter,
  setDeconstructSelection,
  setDeconstructSort,
} from '../../lib/deconstruct/deconstruct-store';
import { rawGear, rawOther, sampleRows } from '../../lib/deconstruct/test-items';
import { addToForgeQueue, cancelForgeQueue, clearForgeQueue, startForgeQueue } from '../../lib/forge/forge-queue-store';
import { resetScreenRefreshForTests, screenRefreshOf } from '../../lib/refresh/screen-refresh-store';
import { DeconstructView } from './deconstruct-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Row = Record<string, unknown>;

function accountView(items: readonly Row[], essence: number | null = 1_000, accountId = 486): AccountView {
  const account = essence === null ? { gold: 500, account_id: accountId } : { gold: 500, essence, account_id: accountId };
  return {
    payload: { items, heroes: [], account },
    gameRunning: true,
    store: { status: 'ok', reason: null, binding: null },
  } as unknown as AccountView;
}

const handlers = new Map<string, ((payload: unknown) => void)[]>();
const startCalls: unknown[] = [];
let startReply: () => unknown = () => ({ ok: true, runId: 'r1' });
let currentView: AccountView = accountView(sampleRows());

function emit(channel: string, payload: unknown): void {
  for (const handler of handlers.get(channel) ?? []) handler(payload);
}

function installBridge(): void {
  (window as unknown as { bfc: unknown }).bfc = {
    invoke: (channel: string, request?: unknown) => {
      if (channel === 'account:get') return Promise.resolve(currentView);
      if (channel === 'deconstruct:start') {
        startCalls.push(request);
        return Promise.resolve(startReply());
      }
      if (channel === 'forge:start') return Promise.resolve({ ok: true, runId: 'f1' });
      return Promise.resolve(undefined);
    },
    on: (channel: string, handler: (payload: unknown) => void) => {
      handlers.set(channel, [...(handlers.get(channel) ?? []), handler]);
      return () => undefined;
    },
  };
}

const QUEUED_FORGE_DONE = {
  type: 'done',
  runId: 'f1',
  result: {
    itemId: 'g-queued',
    from: 8,
    to: 8,
    target: 9,
    stop: 'cancelled',
    reached: false,
    rolls: 0,
    fails: 0,
    crits: 0,
    safeJumps: 0,
    spent: 0,
    walletAfter: 500,
    durationMs: 0,
  },
};

const SETTLE_ANY_BURN = { type: 'done', runId: 'cleanup', itemIds: ['1'], result: { status: 'refused', code: 'CLEANUP' } };

let container: HTMLDivElement;
let root: Root;

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function mount(props: { forgeWritesEnabled?: boolean; accountSource?: AccountSource | null } = {}): Promise<void> {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <CopyProvider locale="en">
        <DeconstructView forgeWritesEnabled={props.forgeWritesEnabled ?? true} accountSource={props.accountSource ?? 'server'} />
      </CopyProvider>,
    );
    await Promise.resolve();
  });
  await flush();
}

async function unmount(): Promise<void> {
  await act(async () => {
    root.unmount();
    await Promise.resolve();
  });
  container.remove();
}

async function pushAccount(view: AccountView): Promise<void> {
  currentView = view;
  await act(async () => {
    emit('account:changed', view);
    await Promise.resolve();
  });
}

beforeAll(() => {
  installBridge();
});

beforeEach(async () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
  startCalls.length = 0;
  startReply = () => ({ ok: true, runId: 'r1' });
  await pushAccount(accountView(sampleRows()));
});

afterEach(async () => {
  await unmount();
  await act(async () => {
    cancelForgeQueue();
    emit('forge:event', QUEUED_FORGE_DONE);
    emit('deconstruct:event', SETTLE_ANY_BURN);
    clearForgeQueue();
    dismissDeconstructRun();
    setDeconstructSelection([]);
    setDeconstructFilter(EMPTY_DECONSTRUCT_FILTER);
    setDeconstructSort(DEFAULT_DECONSTRUCT_SORT);
    setDeconstructEssenceSort(null);
    await Promise.resolve();
  });
  resetScreenRefreshForTests();
});

function byId(testId: string): HTMLElement {
  const element = document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!element) throw new Error(`nothing rendered with test id ${testId}`);
  return element;
}

function buttonById(testId: string): HTMLButtonElement {
  const element = byId(testId);
  if (!(element instanceof HTMLButtonElement)) throw new Error(`${testId} is not a button`);
  return element;
}

function textOf(testId: string): string {
  return byId(testId).textContent;
}

function rowIds(): string[] {
  return [...container.querySelectorAll('[data-testid="inventory-table-row"]')].map((row) => row.getAttribute('data-item-id') ?? '');
}

function rowOf(id: string): HTMLElement {
  const row = container.querySelector<HTMLElement>(`[data-testid="inventory-table-row"][data-item-id="${id}"]`);
  if (!row) throw new Error(`row ${id} is not on screen`);
  return row;
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });
}

async function pick(...ids: string[]): Promise<void> {
  for (const id of ids) await click(rowOf(id));
}

function buttonByText(scope: ParentNode, label: string): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find((button) => button.textContent.trim() === label);
  if (!found) throw new Error(`no button labelled ${label}`);
  return found;
}

function groupRows(): [string, string, string][] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="deconstruct-group-row"]')].map((row) => [
    row.getAttribute('data-group') ?? '',
    row.textContent,
    row.closest('div')?.querySelector('dd')?.textContent ?? '',
  ]);
}

function bagOfGear(count: number, overrides: (index: number) => Row = () => ({})): Row[] {
  return Array.from({ length: count }, (_, index) => rawGear({ id: String(1000 + index), level: 60, ...overrides(index) }));
}

describe('the Deconstruct list', () => {
  it('lists every burnable item and leaves out the chest the server gave no worth', async () => {
    await mount();
    expect(rowIds().sort()).toEqual(['1', '2', '3', '5', '6']);
    expect(textOf('deconstruct-result-count')).toBe('5 of 6');
  });

  it('draws the equipped-by column on a wide window and gives it up on a narrow one', async () => {
    await mount();
    expect(container.textContent).toContain('Equipped by');
    await unmount();

    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    await mount();
    expect(container.textContent).not.toContain('Equipped by');
    expect(container.textContent).toContain('Essence');
  });

  it('gives the batch column what the table can spare, bounded, and a fixed width on a narrow window', async () => {
    await mount();
    const split = byId('deconstruct-split').className;
    expect(split).toContain('grid-cols-[minmax(0,1fr)_clamp(372px,calc(100%_-_750px),540px)]');
    expect(split).toContain('max-compact:grid-cols-[minmax(0,1fr)_316px]');
    expect(byId('deconstruct-aside').className).toContain('@container');
  });

  it('shows what the server pays for each row in its own column, taken from the row and never worked out', async () => {
    await mount();
    expect(rowOf('2').textContent).toContain('200');
    expect(rowOf('1').textContent).toContain('30');
  });

  it('keeps a worn piece out of the list by default and shows it, unable to be ticked, once asked', async () => {
    await mount();
    expect(rowIds()).not.toContain('4');
    await click(byId('deconstruct-hide-unburnable'));
    expect(rowIds()).toContain('4');
  });

  it('gives a blocked row its reason, marks it disabled and refuses to tick it', async () => {
    await mount();
    await click(byId('deconstruct-hide-unburnable'));
    const worn = rowOf('4');
    expect(worn.getAttribute('aria-disabled')).toBe('true');
    expect(worn.textContent).toContain('Unequip this item before burning it.');
    await click(worn);
    expect(textOf('deconstruct-selected')).toBe('0 of 100');
  });

  it('narrows the list from the toolbar, one axis at a time, and clears every one with one press', async () => {
    await mount();
    await click(byId('deconstruct-hide-forged'));
    expect(rowIds().sort()).toEqual(['1', '3', '5', '6']);
    const gems = container.querySelector<HTMLElement>('[data-testid="deconstruct-kind-chip"][data-kind="gem"]');
    if (!gems) throw new Error('no gem chip');
    await click(gems);
    expect(rowIds()).toEqual(['5']);
    await click(byId('deconstruct-clear-filter'));
    expect(rowIds().sort()).toEqual(['1', '2', '3', '5', '6']);
  });

  it('keeps the filter, the order and the ticks when the page is left and opened again', async () => {
    await mount();
    await click(byId('deconstruct-hide-forged'));
    await pick('1');
    await unmount();
    await mount();
    expect(byId('deconstruct-hide-forged').getAttribute('aria-pressed')).toBe('true');
    expect(textOf('deconstruct-selected')).toBe('1 of 100');
  });
});

describe('the batch', () => {
  it('adds the essence the server states for each ticked row, and the balance after the burn', async () => {
    await mount();
    await pick('1', '2');
    expect(textOf('deconstruct-selected')).toBe('2 of 100');
    expect(textOf('deconstruct-essence')).toBe('+230');
    expect(textOf('deconstruct-balance')).toBe('1,000');
    expect(textOf('deconstruct-balance-after')).toBe('1,230');
  });

  it('shows a dash, never a zero, for a balance the read does not carry', async () => {
    await pushAccount(accountView(sampleRows(), null));
    await mount();
    await pick('1');
    expect(textOf('deconstruct-balance')).toBe('—');
    expect(textOf('deconstruct-balance-after')).toBe('—');
  });

  it('unticks a ticked row when it is pressed again', async () => {
    await mount();
    await pick('1', '1');
    expect(textOf('deconstruct-selected')).toBe('0 of 100');
  });

  it('sums the batch into one row per kind and rarity, most numerous first', async () => {
    await pushAccount(
      accountView([
        rawGear({ id: '1', rarity: 0 }),
        rawGear({ id: '2', rarity: 0 }),
        rawGear({ id: '3', rarity: 3, upgrade: 4 }),
        rawOther('4', 'gem_ruby', 2, { rarity: 1 }),
      ]),
    );
    await mount();
    expect(groupRows()).toEqual([]);
    await pick('4', '3', '1', '2');
    expect(groupRows()).toEqual([
      ['equipment:0', 'Common Gear', '2'],
      ['equipment:3', 'Epic Gear', '1'],
      ['gem:1', 'Uncommon Gems', '1'],
    ]);
  });

  it('names a chest by its item level and a cage by its act', async () => {
    await pushAccount(
      accountView([
        rawOther('1', 'chest_item_80', 1),
        rawOther('2', 'chest_item_80', 1),
        rawOther('3', 'chest_hero_5', 1),
      ]),
    );
    await mount();
    await pick('1', '2', '3');
    expect(groupRows().map(([, label, count]) => `${label}: ${count}`)).toEqual(['Item chest · Lv 80: 2', 'Hero cage · Act 5: 1']);
  });

  it('drops a row when its last item is taken out of the batch', async () => {
    await mount();
    await pick('1', '2');
    expect(groupRows()).toHaveLength(2);
    await pick('2');
    expect(groupRows()).toHaveLength(1);
    await click(byId('deconstruct-clear'));
    expect(groupRows()).toEqual([]);
  });

  it('leaves the forged and rarity warnings to the confirm, which still prints both', async () => {
    await mount();
    await pick('1', '2');
    const panel = byId('deconstruct-batch-panel').textContent;
    expect(panel).not.toContain('Forged items in the batch');
    expect(panel).not.toContain('rarity or above');
  });

  it('says what a burn costs under the panel title and nowhere else in the panel', async () => {
    await mount();
    expect(textOf('deconstruct-batch-subtitle')).toBe(en.deconstructBatchSubtitle);
    expect(byId('deconstruct-batch-panel').textContent.split(en.deconstructBatchSubtitle)).toHaveLength(2);
    expect(byId('deconstruct-batch-panel').children[1]).toBe(byId('deconstruct-batch-subtitle'));
  });

  it('empties the batch with Clear', async () => {
    await mount();
    await pick('1', '2');
    await click(byId('deconstruct-clear'));
    expect(textOf('deconstruct-selected')).toBe('0 of 100');
  });

  it('refuses a hundred and first pick with the batch limit line, and keeps the hundred', async () => {
    await pushAccount(accountView([...bagOfGear(100), rawGear({ id: '2000', def_id: 'ember_bota', set: 'ember', level: 1 })]));
    await mount();
    await click(byId('deconstruct-select-shown'));
    expect(textOf('deconstruct-selected')).toBe('100 of 100');
    expect(textOf('deconstruct-hint')).toBe('1 more did not fit under the limit of 100.');

    await act(async () => {
      setDeconstructFilter({ ...EMPTY_DECONSTRUCT_FILTER, sets: ['ember'] });
      await Promise.resolve();
    });
    expect(rowIds()).toEqual(['2000']);
    await pick('2000');
    expect(textOf('deconstruct-selected')).toBe('100 of 100');
    expect(textOf('deconstruct-hint')).toBe('At most 100 items per burn.');
  });

  it('ticks the shown rows up to the cap in the order the list is in, and only the ones the filter shows', async () => {
    await mount();
    await click(byId('deconstruct-hide-forged'));
    await click(byId('deconstruct-select-shown'));
    expect(textOf('deconstruct-selected')).toBe('4 of 100');
    await click(byId('deconstruct-hide-forged'));
    await click(byId('deconstruct-clear'));
    await act(async () => {
      setDeconstructFilter({ ...EMPTY_DECONSTRUCT_FILTER, kinds: ['gem'] });
      await Promise.resolve();
    });
    await click(byId('deconstruct-select-shown'));
    expect(textOf('deconstruct-selected')).toBe('1 of 100');
  });

  it('ticks the first hundred rows as the list is ordered by Essence, not as it is stored', async () => {
    await pushAccount(accountView(bagOfGear(105, (index) => ({ level: 10 + index, essence_value: index + 1 }))));
    await mount();
    expect(rowIds()[0]).toBe('1104');

    await click(buttonByText(container, 'Essence'));
    await click(buttonByText(container, 'Essence'));
    expect(rowIds()[0]).toBe('1000');

    await click(byId('deconstruct-select-shown'));
    const ticked = deconstructSelection();
    expect(ticked).toHaveLength(100);
    expect(ticked).toEqual(Array.from({ length: 100 }, (_, index) => String(1000 + index)));
    expect(textOf('deconstruct-hint')).toBe('5 more did not fit under the limit of 100.');
  });

  it('keeps the Essence order across a visit to another screen', async () => {
    await pushAccount(accountView(bagOfGear(5, (index) => ({ level: 10 + index, essence_value: index + 1 }))));
    await mount();
    await click(buttonByText(container, 'Essence'));
    await click(buttonByText(container, 'Essence'));
    expect(rowIds()).toEqual(['1000', '1001', '1002', '1003', '1004']);

    await unmount();
    await mount();

    expect(rowIds()).toEqual(['1000', '1001', '1002', '1003', '1004']);
  });

  it('fills with Common and Uncommon only, and only from what the filters show', async () => {
    await mount();
    await click(byId('deconstruct-fill'));
    // the Common boots, the Common rune, the Uncommon gloves and the Uncommon gem; not the Epic piece
    expect(textOf('deconstruct-selected')).toBe('4 of 100');
    expect(textOf('deconstruct-essence')).toBe('+53');

    await click(byId('deconstruct-clear'));
    await act(async () => {
      setDeconstructFilter({ ...EMPTY_DECONSTRUCT_FILTER, kinds: ['gem'] });
      await Promise.resolve();
    });
    await click(byId('deconstruct-fill'));
    expect(textOf('deconstruct-selected')).toBe('1 of 100');
  });

  it('says so when a fill finds nothing to add', async () => {
    await mount();
    await act(async () => {
      setDeconstructFilter({ ...EMPTY_DECONSTRUCT_FILTER, rarities: [3] });
      await Promise.resolve();
    });
    await click(byId('deconstruct-fill'));
    expect(textOf('deconstruct-hint')).toBe(en.deconstructHintFillNone);
  });

  it('shows only the ticked rows when asked, to read the batch back', async () => {
    await mount();
    await pick('1', '5');
    await click(byId('deconstruct-selected-only'));
    expect(rowIds().sort()).toEqual(['1', '5']);
  });

  it('drops a tick from the batch when a newer read no longer holds the item', async () => {
    await mount();
    await pick('1', '2');
    await unmount();
    await pushAccount(accountView(sampleRows().filter((row) => row.id !== '2')));
    await mount();
    expect(textOf('deconstruct-selected')).toBe('1 of 100');
    expect(deconstructSelection()).toEqual(['1']);
  });

  it('drops a tick whose item has since been equipped', async () => {
    await mount();
    await pick('1', '3');
    await unmount();
    await pushAccount(accountView(sampleRows().map((row) => (row.id === '3' ? { ...row, equipped_on: 'h9' } : row))));
    await mount();
    expect(textOf('deconstruct-selected')).toBe('1 of 100');
    expect(deconstructSelection()).toEqual(['1']);
  });

  it('counts the ticks the current filters hide, and keeps that line in the tree while there are none', async () => {
    await mount();
    const note = byId('deconstruct-hidden-note');
    expect(note.className).toContain('invisible');
    expect(note.getAttribute('aria-hidden')).toBe('true');

    await pick('1', '2');
    expect(note.className).toContain('invisible');
    await click(byId('deconstruct-hide-forged'));
    expect(textOf('deconstruct-selected')).toBe('2 of 100');
    expect(note.getAttribute('data-active')).toBe('true');
    expect(note.getAttribute('aria-hidden')).toBeNull();
    expect(note.className).not.toContain('invisible');
    expect(note.textContent).toBe('1 not shown by the current filters');

    await click(byId('deconstruct-hide-forged'));
    expect(note.className).toContain('invisible');
  });

  it('adds the hidden ticks to the confirm, and leaves the line out when the filters hide none', async () => {
    await mount();
    await pick('1', '2');
    await click(byId('deconstruct-burn'));
    const plain = document.body.querySelector<HTMLElement>('[role="dialog"]');
    if (!plain) throw new Error('no confirm opened');
    expect(plain.textContent).not.toContain('not shown by the current filters');
    await click(buttonByText(plain, en.deconstructConfirmCancel));

    await click(byId('deconstruct-hide-forged'));
    await click(byId('deconstruct-burn'));
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('no confirm opened');
    expect(confirmFigure(dialog, 'deconstruct-confirm-items')).toBe('2');
    expect(dialog.textContent).toContain('1 of these are not shown by the current filters.');
  });
});

describe('the batch on the Burn press', () => {
  function equipped(id: string): AccountView {
    return accountView(sampleRows().map((row) => (row.id === id ? { ...row, equipped_on: 'h9' } : row)));
  }

  async function pressBurn(): Promise<HTMLElement | null> {
    await click(byId('deconstruct-burn'));
    return document.body.querySelector<HTMLElement>('[role="dialog"]');
  }

  it('opens the confirm for what the live account still lets burn, and sends only that', async () => {
    await mount();
    await pick('1', '3');
    await pushAccount(equipped('3'));
    expect(textOf('deconstruct-selected')).toBe('2 of 100');

    const dialog = await pressBurn();
    if (!dialog) throw new Error('no confirm opened');
    expect(confirmFigure(dialog, 'deconstruct-confirm-items')).toBe('1');
    expect(textOf('deconstruct-hint')).toBe('1 item left your batch because it can no longer be burned.');
    expect(deconstructSelection()).toEqual(['1']);

    await click(buttonByText(dialog, 'Burn 1'));
    await flush();
    expect(startCalls).toEqual([{ itemIds: ['1'] }]);
  });

  it('says how many left the batch when several did, in the plural', async () => {
    await mount();
    await pick('1', '3', '5');
    await pushAccount(accountView(sampleRows().filter((row) => row.id === '1')));
    const dialog = await pressBurn();
    expect(dialog && confirmFigure(dialog, 'deconstruct-confirm-items')).toBe('1');
    expect(textOf('deconstruct-hint')).toBe('2 items left your batch because they can no longer be burned.');
  });

  it('adopts the live list with the press, so what the player sees is what the confirm names', async () => {
    await mount();
    await pick('1', '3');
    await pushAccount(equipped('3'));
    expect(rowIds()).toContain('3');
    await pressBurn();
    expect(rowIds()).not.toContain('3');
  });

  it('opens no confirm when nothing in the batch can be burned any more', async () => {
    await mount();
    await pick('3');
    await pushAccount(equipped('3'));
    expect(await pressBurn()).toBeNull();
    expect(textOf('deconstruct-selected')).toBe('0 of 100');
    expect(textOf('deconstruct-hint')).toBe('1 item left your batch because it can no longer be burned.');
    expect(startCalls).toEqual([]);
  });

  it('leaves the hint empty when every tick still holds', async () => {
    await mount();
    await pick('1');
    expect(await pressBurn()).not.toBeNull();
    expect(textOf('deconstruct-hint')).toBe('');
  });
});

describe('the add-all button', () => {
  it('sits in the list header beside the count and not in the batch panel', async () => {
    await mount();
    const button = byId('deconstruct-select-shown');
    expect(byId('deconstruct-toolbar').contains(button)).toBe(true);
    expect(byId('deconstruct-batch-panel').contains(button)).toBe(false);
  });

  it('says how many shown rows it would add, and counts down as they go into the batch', async () => {
    await mount();
    expect(textOf('deconstruct-select-shown')).toBe('Add all 5 to the batch');
    await pick('1');
    expect(textOf('deconstruct-select-shown')).toBe('Add all 4 to the batch');
    await click(byId('deconstruct-hide-forged'));
    expect(textOf('deconstruct-select-shown')).toBe('Add all 3 to the batch');
  });

  it('is off once everything shown is in the batch', async () => {
    await mount();
    await click(byId('deconstruct-select-shown'));
    expect(textOf('deconstruct-select-shown')).toBe('Add all 0 to the batch');
    expect(buttonById('deconstruct-select-shown').disabled).toBe(true);
    expect(deconstructSelection()).toHaveLength(5);
  });

  it('is off when no shown row can be burned', async () => {
    await mount();
    await act(async () => {
      setDeconstructFilter({ ...EMPTY_DECONSTRUCT_FILTER, text: 'no such item' });
      await Promise.resolve();
    });
    expect(buttonById('deconstruct-select-shown').disabled).toBe(true);
  });

  it('keeps saying the shown count when the batch has room for fewer, and the hint says how many did not fit', async () => {
    await pushAccount(accountView(bagOfGear(105)));
    await mount();
    expect(textOf('deconstruct-select-shown')).toBe('Add all 105 to the batch');
    await click(byId('deconstruct-select-shown'));
    expect(textOf('deconstruct-selected')).toBe('100 of 100');
    expect(textOf('deconstruct-hint')).toBe('5 more did not fit under the limit of 100.');
    expect(textOf('deconstruct-select-shown')).toBe('Add all 5 to the batch');
  });

  it('is off while a burn is in flight', async () => {
    await mount();
    await pick('1');
    await click(byId('deconstruct-burn'));
    await click(buttonByText(document.body, 'Burn 1'));
    await flush();
    expect(buttonById('deconstruct-select-shown').disabled).toBe(true);
  });
});

function tileIds(): string[] {
  return [...container.querySelectorAll('[data-testid="deconstruct-batch-tile"]')].map((tile) => tile.getAttribute('data-item-id') ?? '');
}

function removeMark(id: string): HTMLButtonElement {
  const mark = container.querySelector<HTMLButtonElement>(`[data-testid="deconstruct-batch-tile"][data-item-id="${id}"] button`);
  if (!mark) throw new Error(`tile ${id} has no remove mark`);
  return mark;
}

describe('the batch tiles', () => {
  it('say what to do until something is ticked, and say it again once the last tile is taken out', async () => {
    await mount();
    expect(textOf('deconstruct-batch-empty')).toBe(en.deconstructBatchEmpty);
    await pick('1');
    expect(container.querySelector('[data-testid="deconstruct-batch-empty"]')).toBeNull();
    await click(removeMark('1'));
    expect(textOf('deconstruct-batch-empty')).toBe(en.deconstructBatchEmpty);
    expect(tileIds()).toEqual([]);
  });

  it('follow the order the rows were ticked in, not the order of the list', async () => {
    await mount();
    await pick('3', '1', '2');
    expect(tileIds()).toEqual(['3', '1', '2']);
  });

  it('still show a ticked item the filters hide, because it is in the batch all the same', async () => {
    await mount();
    await pick('1', '2');
    await click(byId('deconstruct-hide-forged'));
    expect(rowIds()).not.toContain('2');
    expect(tileIds()).toEqual(['1', '2']);
    expect(byId('deconstruct-hidden-note').getAttribute('data-active')).toBe('true');
  });

  it('take out exactly the item whose mark is pressed, and the count, the essence and the row follow', async () => {
    await mount();
    await pick('1', '2', '3');
    expect(textOf('deconstruct-essence')).toBe('+240');
    await click(removeMark('2'));
    expect(tileIds()).toEqual(['1', '3']);
    expect(deconstructSelection()).toEqual(['1', '3']);
    expect(textOf('deconstruct-selected')).toBe('2 of 100');
    expect(textOf('deconstruct-essence')).toBe('+40');
    expect(textOf('deconstruct-balance-after')).toBe('1,040');
    expect(rowOf('2').querySelector('[role="checkbox"]')?.getAttribute('aria-checked')).toBe('false');
  });

  it('take out an item the filters hide, and clear the line about hidden ticks with it', async () => {
    await mount();
    await pick('1', '2');
    await click(byId('deconstruct-hide-forged'));
    await click(removeMark('2'));
    expect(tileIds()).toEqual(['1']);
    expect(byId('deconstruct-hidden-note').getAttribute('data-active')).toBe('false');
  });

  it('clear the hint left by the last press when an item is taken out', async () => {
    await mount();
    await click(byId('deconstruct-fill'));
    await click(byId('deconstruct-fill'));
    expect(textOf('deconstruct-hint')).toBe(en.deconstructHintFillNone);
    await click(removeMark('1'));
    expect(textOf('deconstruct-hint')).toBe('');
  });

  it('leave the region on one flex rule in the panel at no ticks, one tick and every tick', async () => {
    await mount();
    const height = () => byId('deconstruct-batch-tiles').className;
    const empty = height();
    await pick('1');
    expect(height()).toBe(empty);
    await click(byId('deconstruct-select-shown'));
    expect(tileIds().length).toBeGreaterThan(1);
    expect(height()).toBe(empty);
  });

  it('cannot be taken out while a burn is in flight', async () => {
    await mount();
    await pick('1');
    await click(byId('deconstruct-burn'));
    const confirm = buttonByText(document.body, 'Burn 1');
    await click(confirm);
    await flush();
    expect(removeMark('1').disabled).toBe(true);
  });
});

describe('a different game account', () => {
  it('empties the batch when another account is loaded in place', async () => {
    await mount();
    await pick('1', '2');
    expect(textOf('deconstruct-selected')).toBe('2 of 100');
    await pushAccount(accountView(sampleRows(), 1_000, 777));
    expect(textOf('deconstruct-selected')).toBe('0 of 100');
    expect(deconstructSelection()).toEqual([]);
  });

  it("shows the new account's list at once instead of waiting for a refresh", async () => {
    await mount();
    await pushAccount(accountView(sampleRows().filter((row) => row.id !== '1'), 1_000, 777));
    expect(rowIds()).not.toContain('1');
  });

  it('takes the result of the last burn off the screen', async () => {
    await mount();
    await act(async () => {
      emit('deconstruct:event', { type: 'done', runId: 'r9', itemIds: ['1'], result: { status: 'refused', code: 'ITEM_EQUIPPED' } });
      await Promise.resolve();
    });
    expect(byId('deconstruct-result-slot').children).toHaveLength(1);
    await pushAccount(accountView(sampleRows(), 1_000, 777));
    expect(byId('deconstruct-result-slot').children).toHaveLength(0);
  });

  it('keeps the batch when a read names no account at all', async () => {
    await mount();
    await pick('1');
    const nameless = accountView(sampleRows());
    await pushAccount({ ...nameless, payload: { ...nameless.payload, account: { gold: 500, essence: 1_000 } } });
    expect(textOf('deconstruct-selected')).toBe('1 of 100');
  });
});

describe('the Burn button', () => {
  it('is armed once there is a batch, a server and the switch is on', async () => {
    await mount();
    await pick('1');
    const burn = buttonById('deconstruct-burn');
    expect(burn.disabled).toBe(false);
    expect(burn.getAttribute('data-reason')).toBe('ready');
  });

  it('says why it is off when nothing is ticked', async () => {
    await mount();
    expect(buttonById('deconstruct-burn').disabled).toBe(true);
    expect(textOf('deconstruct-burn-reason')).toBe(en.deconstructReasonNone);
  });

  it('points at the Settings switch by its exact label when writes are off', async () => {
    await mount({ forgeWritesEnabled: false });
    await pick('1');
    expect(buttonById('deconstruct-burn').disabled).toBe(true);
    expect(textOf('deconstruct-burn-reason')).toBe(`Turn on "${en.settingsForgeWritesLabel}" in Settings to burn from here`);
  });

  it('says there is no server behind an offline account, ahead of the switch', async () => {
    await mount({ forgeWritesEnabled: false, accountSource: 'fixture' });
    await pick('1');
    expect(textOf('deconstruct-burn-reason')).toBe(en.deconstructReasonFixture);
  });

  it('stays off while the forge queue is running, since both want the one write lock', async () => {
    await mount();
    await pick('1');
    await act(async () => {
      addToForgeQueue('g-queued', 9);
      startForgeQueue();
      await Promise.resolve();
    });
    await flush();
    expect(buttonById('deconstruct-burn').disabled).toBe(true);
    expect(textOf('deconstruct-burn-reason')).toBe(en.deconstructReasonForge);
  });
});

function within(root: HTMLElement, testId: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (!element) throw new Error(`nothing rendered with test id ${testId} inside the dialog`);
  return element;
}

function confirmFigure(dialog: HTMLElement, testId: string): string {
  const figure = within(dialog, testId).querySelectorAll('p')[1];
  if (!figure) throw new Error(`${testId} has no figure line`);
  return figure.textContent;
}

describe('the confirm', () => {
  async function openConfirm(): Promise<HTMLElement> {
    await click(byId('deconstruct-burn'));
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('no confirm opened');
    return dialog;
  }

  it('always asks before burning, with the count, the essence and that it cannot be undone', async () => {
    await mount();
    await pick('1');
    const dialog = await openConfirm();
    expect(dialog.textContent).toContain('Burn these items?');
    expect(dialog.textContent).toContain(en.deconstructConfirmItems);
    expect(confirmFigure(dialog, 'deconstruct-confirm-items')).toBe('1');
    expect(dialog.textContent).toContain(en.deconstructConfirmEssence);
    expect(confirmFigure(dialog, 'deconstruct-confirm-essence')).toBe('+30');
    expect(startCalls).toEqual([]);
  });

  it('shows the balance before and after the burn under the essence, and a dash when the read has none', async () => {
    await mount();
    await pick('1', '2');
    const dialog = await openConfirm();
    expect(within(dialog, 'deconstruct-confirm-essence').textContent).toContain('1,000 → 1,230');
    await click(buttonByText(dialog, en.deconstructConfirmCancel));
    await unmount();
    await act(async () => {
      setDeconstructSelection([]);
      await Promise.resolve();
    });

    await pushAccount(accountView(sampleRows(), null));
    await mount();
    await pick('1');
    const unknown = await openConfirm();
    expect(within(unknown, 'deconstruct-confirm-essence').textContent).toBe(`${en.deconstructConfirmEssence}+30—`);
  });

  it('states in a danger callout that a burn cannot be undone and when the items are destroyed', async () => {
    await mount();
    await pick('1');
    const callout = within(await openConfirm(), 'deconstruct-confirm-irreversible');
    expect(callout.textContent).toContain(en.deconstructConfirmIrreversible);
    expect(callout.textContent).toContain(en.deconstructConfirmDestroyed);
    expect(callout.className).toContain('var(--down)');
  });

  it('lists what burns by group, one row per kind and rarity, over a title', async () => {
    await mount();
    await pick('1', '2', '5');
    const section = within(await openConfirm(), 'deconstruct-confirm-groups');
    expect(section.textContent).toContain(en.deconstructConfirmGroupsTitle);
    expect(section.querySelectorAll('[data-testid="deconstruct-group-row"]')).toHaveLength(3);
  });

  it('keeps the groups list to its own scroll region so a long batch cannot outgrow the window', async () => {
    await mount();
    await pick('1', '2', '5');
    const region = within(await openConfirm(), 'deconstruct-confirm-groups').querySelector('[data-testid="deconstruct-batch-groups"]');
    expect(region?.className).toContain('overflow-y-auto');
    expect(region?.className).toContain('max-h-[7.125rem]');
    expect(region?.className).not.toContain('max-h-[4.75rem]');
  });

  it('puts the warnings in a warn callout only when the batch holds them, one line each', async () => {
    await mount();
    await pick('1');
    const plain = await openConfirm();
    expect(plain.querySelector('[data-testid="deconstruct-confirm-warnings"]')).toBeNull();
    await click(buttonByText(plain, en.deconstructConfirmCancel));

    await pick('2');
    const warned = within(await openConfirm(), 'deconstruct-confirm-warnings');
    expect([...warned.querySelectorAll('li')].map((line) => line.textContent)).toEqual([
      'Forged items in the batch: 1. Their forge is lost, and only part of the Essence comes back.',
      'Items of Epic rarity or above in the batch: 1.',
    ]);
  });

  it('is described by its own body, which holds the figures and the callout', async () => {
    await mount();
    await pick('1');
    const dialog = await openConfirm();
    const body = document.getElementById(dialog.getAttribute('aria-describedby') ?? '');
    expect(body?.querySelector('[data-testid="deconstruct-confirm-items"]')).not.toBeNull();
    expect(body?.querySelector('[data-testid="deconstruct-confirm-irreversible"]')).not.toBeNull();
  });

  it('lands focus on the corner close, never on the destructive button', async () => {
    await mount();
    await pick('1');
    const dialog = await openConfirm();
    expect(document.activeElement).toBe(dialog.querySelector(`button[aria-label="${en.confirmDialogClose}"]`));
  });

  it('prints the forged and the Epic-or-rarer lines only when the batch holds them', async () => {
    await mount();
    await pick('1');
    const plain = await openConfirm();
    expect(plain.textContent).not.toContain('Forged items in the batch');
    expect(plain.textContent).not.toContain('Epic rarity or above');
    await click(buttonByText(plain, en.deconstructConfirmCancel));

    await pick('2');
    const warned = await openConfirm();
    expect(warned.textContent).toContain('Forged items in the batch: 1.');
    expect(warned.textContent).toContain('Items of Epic rarity or above in the batch: 1.');
  });

  it('sends exactly the ticked ids through deconstruct:start, in the order they were ticked, on confirm', async () => {
    await mount();
    await pick('2', '1', '5');
    const dialog = await openConfirm();
    await click(buttonByText(dialog, 'Burn 3'));
    await flush();
    expect(startCalls).toEqual([{ itemIds: ['2', '1', '5'] }]);
  });

  it('sends nothing when the player backs out', async () => {
    await mount();
    await pick('1');
    const dialog = await openConfirm();
    await click(buttonByText(dialog, en.deconstructConfirmCancel));
    await flush();
    expect(startCalls).toEqual([]);
    expect(textOf('deconstruct-selected')).toBe('1 of 100');
  });
});

describe('the result band', () => {
  async function burn(...ids: string[]): Promise<void> {
    await pick(...ids);
    await click(byId('deconstruct-burn'));
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('no confirm opened');
    await click(buttonByText(dialog, `Burn ${String(ids.length)}`));
    await flush();
  }

  function done(result: DeconstructEvent extends infer E ? (E extends { result: infer R } ? R : never) : never, itemIds: string[]): DeconstructEvent {
    return { type: 'done', runId: 'r1', itemIds, result };
  }

  it('is in the tree and empty until a burn settles', async () => {
    await mount();
    expect(byId('deconstruct-result-slot').children).toHaveLength(0);
  });

  it('keeps Burn off while the answer is awaited', async () => {
    await mount();
    await burn('1');
    expect(buttonById('deconstruct-burn').disabled).toBe(true);
    expect(textOf('deconstruct-burn-reason')).toBe(en.deconstructReasonRunning);
  });

  it('reports a burn with the essence the server paid and the balance it left, and unticks what was burned', async () => {
    await mount();
    await burn('1', '2');
    await act(async () => {
      emit('deconstruct:event', done({ status: 'burned', burned: 2, gained: 230, essence: 1_230 }, ['1', '2']));
      await Promise.resolve();
    });
    const band = byId('deconstruct-result');
    expect(band.getAttribute('data-outcome')).toBe('burned');
    expect(band.textContent).toContain('Burned 2 items: +230 Forge Essence');
    expect(band.textContent).toContain('Forge Essence now: 1,230');
    expect(textOf('deconstruct-selected')).toBe('0 of 100');
  });

  it('reports a refusal as nothing burned with the reason, and keeps the ticks', async () => {
    await mount();
    await burn('1');
    await act(async () => {
      emit('deconstruct:event', done({ status: 'refused', code: 'ITEM_HAS_GEMS' }, ['1']));
      await Promise.resolve();
    });
    const band = byId('deconstruct-result');
    expect(band.getAttribute('data-outcome')).toBe('refused');
    expect(band.textContent).toContain('Nothing was burned: the batch was refused.');
    expect(band.textContent).toContain("This item has a socketed gem and can't be burned.");
    expect(textOf('deconstruct-selected')).toBe('1 of 100');
  });

  it('prints the code for a refusal it has no wording for', async () => {
    await mount();
    await burn('1');
    await act(async () => {
      emit('deconstruct:event', done({ status: 'refused', code: 'SOMETHING_NEW' }, ['1']));
      await Promise.resolve();
    });
    expect(textOf('deconstruct-result')).toContain('SOMETHING_NEW');
  });

  it('reports a failure honestly: the burn may or may not have gone through', async () => {
    await mount();
    await burn('1');
    await act(async () => {
      emit('deconstruct:event', done({ status: 'failed', reason: 'network' }, ['1']));
      await Promise.resolve();
    });
    const band = byId('deconstruct-result');
    expect(band.getAttribute('data-outcome')).toBe('failed');
    expect(band.textContent).toContain('The connection dropped before the answer.');
    expect(band.textContent).toContain('may or may not');
  });

  it('reports a start that main refused, with its own wording', async () => {
    startReply = () => ({ ok: false, reason: 'game_not_running' });
    await mount();
    await burn('1');
    const band = byId('deconstruct-result');
    expect(band.getAttribute('data-outcome')).toBe('start-refused');
    expect(band.textContent).toContain(en.deconstructStartGameNotRunning);
  });

  it('survives leaving the page and coming back, and goes away on Done', async () => {
    await mount();
    await burn('1');
    await act(async () => {
      emit('deconstruct:event', done({ status: 'refused', code: 'ITEM_EQUIPPED' }, ['1']));
      await Promise.resolve();
    });
    await unmount();
    await mount();
    expect(byId('deconstruct-result').getAttribute('data-outcome')).toBe('refused');
    await click(byId('deconstruct-done'));
    expect(byId('deconstruct-result-slot').children).toHaveLength(0);
  });
});

describe('the account read', () => {
  it('pins the list: a newer read does not move rows until the shell refreshes, and the shell is told it is behind', async () => {
    await mount();
    const before = rowIds().sort();
    await pushAccount(accountView(sampleRows().filter((row) => row.id !== '1')));
    expect(rowIds().sort()).toEqual(before);
    expect(screenRefreshOf('forge')?.stale).toBe(true);
  });

  it('registers its refresh under the Forge tab while it is mounted and withdraws it on leaving', async () => {
    await mount();
    expect(screenRefreshOf('forge')).not.toBeNull();
    await unmount();
    expect(screenRefreshOf('forge')).toBeNull();
    await mount();
  });

  it('adopts the newer read once a burn settles, so the list shows what is left', async () => {
    await mount();
    await pick('1');
    await click(byId('deconstruct-burn'));
    const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) throw new Error('no confirm opened');
    await click(buttonByText(dialog, 'Burn 1'));
    await flush();
    await pushAccount(accountView(sampleRows().filter((row) => row.id !== '1'), 1_030));
    expect(rowIds()).toContain('1');
    await act(async () => {
      emit('deconstruct:event', { type: 'done', runId: 'r1', itemIds: ['1'], result: { status: 'burned', burned: 1, gained: 30, essence: 1_030 } });
      await Promise.resolve();
    });
    expect(rowIds()).not.toContain('1');
    expect(textOf('deconstruct-balance')).toBe('1,030');
  });
});
