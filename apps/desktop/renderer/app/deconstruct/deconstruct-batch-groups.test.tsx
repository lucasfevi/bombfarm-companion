// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { ptBR } from '../../lib/copy/pt-BR';
import { rawGear, rawOther, viewItems } from '../../lib/deconstruct/test-items';
import { DeconstructBatchGroups } from './deconstruct-batch-groups';
import { deconstructLabels } from './deconstruct-labels';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | undefined;
let root: Root | undefined;

async function mount(items: readonly InventoryViewItem[], locale: 'en' | 'pt-BR' = 'en'): Promise<void> {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const mounted = root;
  await act(async () => {
    mounted.render(
      <CopyProvider locale={locale}>
        <DeconstructBatchGroups
          items={items}
          labels={locale === 'en' ? deconstructLabels(en, 'en', 'en') : deconstructLabels(ptBR, 'pt', 'pt-BR')}
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

const region = () => container?.querySelector<HTMLElement>('[data-testid="deconstruct-batch-groups"]');
const rows = () => [...(container?.querySelectorAll<HTMLElement>('[data-testid="deconstruct-group-row"]') ?? [])];
const countOf = (row: HTMLElement) => row.closest('div')?.querySelector('dd')?.textContent ?? '';

const BATCH = viewItems([
  rawOther('1', 'key_a', 4, { rarity: 3 }),
  rawOther('2', 'key_b', 4, { rarity: 3 }),
  rawGear({ id: '3', rarity: 0 }),
  rawOther('4', 'chest_item_80', 1),
]);

describe('the batch groups', () => {
  it('print a label and a count per row, most numerous first', async () => {
    await mount(BATCH);
    expect(rows().map((row) => `${row.textContent}: ${countOf(row)}`)).toEqual([
      'Epic Keys: 2',
      'Common Gear: 1',
      'Item chest · Lv 80: 1',
    ]);
    expect(rows().map((row) => row.getAttribute('data-count'))).toEqual(['2', '1', '1']);
  });

  it('set the counts right-aligned in tabular figures', async () => {
    await mount(BATCH);
    const list = container?.querySelector('dl')?.className ?? '';
    expect(list).toContain('[&_dd]:text-right');
    expect(list).toContain('[&_dd]:tabular-nums');
  });

  it('name the list for assistive tech', async () => {
    await mount(BATCH);
    expect(container?.querySelector('dl')?.getAttribute('aria-label')).toBe(en.deconstructGroupsLabel);
  });

  it('read in Portuguese with the kind first', async () => {
    await mount(BATCH, 'pt-BR');
    expect(rows().map((row) => row.textContent)).toEqual(['Chaves · Épico', 'Baú de item · Nv 80', 'Equipamentos · Comum']);
  });

  it('leave only a rule and no rows for an empty batch', async () => {
    await mount([]);
    expect(rows()).toHaveLength(0);
    expect(region()?.className).toContain('border-t');
    expect(region()?.className).not.toMatch(/(^| )(min-h-|h-)/);
  });

  it('cap their height and scroll on their own, and shrink before the tiles do', async () => {
    await mount(BATCH);
    const classes = region()?.className.split(' ') ?? [];
    expect(classes).toEqual(expect.arrayContaining(['overflow-y-auto', 'max-h-[7.125rem]', '[@media(max-height:820px)]:max-h-[4.75rem]', 'shrink']));
  });
});
