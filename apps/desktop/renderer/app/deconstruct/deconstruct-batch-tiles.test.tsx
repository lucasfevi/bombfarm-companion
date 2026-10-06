// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { rawGear, viewItems } from '../../lib/deconstruct/test-items';
import { DeconstructBatchTiles } from './deconstruct-batch-tiles';
import { deconstructLabels } from './deconstruct-labels';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;
let root: Root | undefined;

const labels = deconstructLabels(en, 'en', 'en');

function gear(count: number): InventoryViewItem[] {
  return viewItems(Array.from({ length: count }, (_, index) => rawGear({ id: String(100 + index), upgrade: index === 1 ? 7 : 0 })));
}

async function mount(
  items: readonly InventoryViewItem[],
  { disabled = false, onRemove = vi.fn(), locale = 'en' }: { disabled?: boolean; onRemove?: (id: string) => void; locale?: 'en' | 'pt-BR' } = {},
): Promise<void> {
  if (container === undefined || root === undefined) {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  }
  const mounted = root;
  await act(async () => {
    mounted.render(
      <CopyProvider locale={locale}>
        <DeconstructBatchTiles
          items={items}
          labels={locale === 'en' ? labels : deconstructLabels(ptBR, 'pt', 'pt-BR')}
          disabled={disabled}
          onRemove={onRemove}
        />
      </CopyProvider>,
    );
    await Promise.resolve();
  });
}

afterEach(async () => {
  const mounted = root;
  await act(async () => {
    mounted?.unmount();
    await Promise.resolve();
  });
  container?.remove();
  container = undefined;
  root = undefined;
});

const tiles = () => [...(container?.querySelectorAll<HTMLElement>('[data-testid="deconstruct-batch-tile"]') ?? [])];
const removeMarks = () => [...(container?.querySelectorAll<HTMLButtonElement>('[data-testid="deconstruct-batch-remove"]') ?? [])];
const region = () => container?.querySelector<HTMLElement>('[data-testid="deconstruct-batch-tiles"]');

describe('the batch tiles', () => {
  it('draw one tile per ticked item, in the order they were ticked', async () => {
    const items = gear(4);
    await mount([2, 0, 3].flatMap((index) => items.slice(index, index + 1)));
    expect(tiles().map((tile) => tile.getAttribute('data-item-id'))).toEqual(['102', '100', '103']);
  });

  it('show the forge level of a forged item and leave the level glyph to the list', async () => {
    await mount(gear(3));
    const [plain, forged] = tiles();
    expect(plain?.querySelector('[data-slot="item-upgrade"]')).toBeNull();
    expect(forged?.querySelector('[data-slot="item-upgrade"]')?.textContent).toBe('+7');
    expect(container?.querySelector('[data-slot="item-level"]')).toBeNull();
  });

  it('name the item on the card trigger and on its remove button', async () => {
    const [item] = gear(1);
    if (!item) throw new Error('no item');
    const name = labels.itemName(item);
    await mount([item]);
    const trigger = tiles()[0]?.querySelector('[data-peek="item"]');
    expect(trigger?.getAttribute('aria-label')?.startsWith(`${name}. `)).toBe(true);
    const remove = tiles()[0]?.querySelector('button');
    expect(remove?.getAttribute('aria-label')).toBe(`Remove ${name} from the batch`);
  });

  it('say so in Portuguese on the remove button', async () => {
    await mount(gear(1), { locale: 'pt-BR' });
    expect(tiles()[0]?.querySelector('button')?.getAttribute('aria-label')).toMatch(/^Tirar .+ do lote$/);
  });

  it('open the item card when the pointer moves over a tile', async () => {
    const items = gear(2);
    const forged = items[1];
    if (!forged) throw new Error('no forged item');
    await mount(items);
    const trigger = tiles()[1]?.querySelector('[data-peek="item"]');
    if (!trigger) throw new Error('no card trigger');
    expect(document.body.querySelector('[data-peek-card="item"]')).toBeNull();

    await act(async () => {
      trigger.dispatchEvent(new Event('pointermove', { bubbles: true }));
      await Promise.resolve();
    });
    const card = document.body.querySelector('[data-peek-card="item"]');
    expect(card).not.toBeNull();
    expect(card?.textContent).toContain(labels.itemName(forged));
    expect(card?.textContent).toContain('+7');
  });

  it('take back exactly the item whose mark is pressed', async () => {
    const onRemove = vi.fn();
    await mount(gear(3), { onRemove });
    const remove = tiles()[1]?.querySelector('button');
    await act(async () => {
      remove?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith('101');
  });

  it('keep every remove mark a native button in the tab order, so Enter and Space press it', async () => {
    await mount(gear(3));
    const marks = removeMarks();
    expect(marks).toHaveLength(3);
    for (const mark of marks) {
      expect(mark.tagName).toBe('BUTTON');
      expect(mark.type).toBe('button');
      expect(mark.tabIndex).toBe(0);
    }
  });

  it('move focus to the next remove mark when one is pressed, so a keyboard user can keep clearing', async () => {
    await mount(gear(3));
    const marks = removeMarks();
    marks[0]?.focus();
    await act(async () => {
      marks[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(document.activeElement).toBe(marks[1]);
  });

  it('turn the remove marks off while a burn is in flight', async () => {
    await mount(gear(2), { disabled: true });
    for (const mark of removeMarks()) {
      expect(mark.disabled).toBe(true);
    }
  });

  it('say what to do in the region when nothing is ticked, instead of collapsing', async () => {
    await mount([]);
    expect(container?.querySelector('[data-testid="deconstruct-batch-empty"]')?.textContent).toBe(en.deconstructBatchEmpty);
    expect(tiles()).toHaveLength(0);
  });

  it('take whatever height the panel has left, with a two-row floor, at zero, one and thirty tiles', async () => {
    const rule = () => region()?.className.split(' ').filter((name) => /^(flex-\[|min-h-|h-|overflow-y-)/.test(name)).join(' ');
    await mount([]);
    const empty = rule();
    expect(empty).toContain('flex-[1_1_0px]');
    expect(empty).toContain('min-h-[5.8rem]');
    expect(empty).toContain('overflow-y-auto');
    expect(empty).not.toMatch(/(^| )h-/);
    await mount(gear(1));
    expect(rule()).toBe(empty);
    await mount(gear(30));
    expect(rule()).toBe(empty);
  });
});
