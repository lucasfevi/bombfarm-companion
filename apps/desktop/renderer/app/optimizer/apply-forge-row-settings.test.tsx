import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { forgeForecast } from '@bombfarm/domain/forge';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import type { ForgeAction } from '@bombfarm/domain/team-plan/types';
import { CopyProvider } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import { formatCount } from '../../lib/format';
import { EMPTY_FORGE_QUEUE } from '../../lib/forge/forge-queue-reducer';
import type { ForgeQueueSettings } from '../../lib/forge/forge-queue-settings';
import { forgeLabels } from '../forge/forge-labels';

const settings = vi.hoisted(() => ({ current: null as unknown as ForgeQueueSettings }));

vi.mock('../../lib/forge/forge-queue-settings-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/forge/forge-queue-settings-store')>();
  return { ...actual, useForgeQueueSettings: () => settings.current };
});

const { ApplyForgeRow } = await import('./apply-forge-row');

const labels = forgeLabels(en, 'en', 'en');
const NO_STONES = [0, 0, 0, 0, 0, 0];
const COMMON_FROM_TEN: ForgeQueueSettings = {
  ranges: [
    { upTo: 9, rarity: null },
    { upTo: 15, rarity: 0 },
  ],
  stopWhenOutOfStones: true,
  scroll: false,
};

function gearItem(id: string, upgrade: number): InventoryViewItem {
  return { id, upgrade, level: 30, rarityIdx: 1, defId: `def-${id}` } as unknown as InventoryViewItem;
}

function renderRow(current: ForgeQueueSettings, ownedStones: number[]): string {
  settings.current = current;
  const action: ForgeAction = { itemId: 'a', defId: 'def-a', from: 0, to: 15 };
  return renderToStaticMarkup(
    createElement(CopyProvider, {
      locale: 'en',
      children: createElement(ApplyForgeRow, {
        forgeList: [action],
        planRunId: 'run-1',
        queue: EMPTY_FORGE_QUEUE,
        gear: [gearItem('a', 9)],
        ownedStones,
        labels,
        gate: null,
        record: { status: 'idle' },
        onDone: () => undefined,
      }),
    }),
  );
}

function essenceFigure(essence: number): string {
  return `${formatCount(Math.round(essence), 'en')} essence expected`;
}

describe('ApplyForgeRow prices under the queue settings', () => {
  it('prices the pieces it adds with the Protection Scroll when the queue uses it', () => {
    const plain = { ranges: [], stopWhenOutOfStones: true, scroll: false };
    const withoutScroll = renderRow(plain, NO_STONES);
    const withScroll = renderRow({ ...plain, scroll: true }, NO_STONES);
    expect(withoutScroll).toContain(essenceFigure(forgeForecast(9, 15, 30, 1).essence));
    expect(withScroll).toContain(essenceFigure(forgeForecast(9, 15, 30, 1, 0, { protect: true }).essence));
  });

  it('prices the pieces it adds without a stone the account does not hold, when the queue rolls on without it', () => {
    const html = renderRow({ ...COMMON_FROM_TEN, stopWhenOutOfStones: false }, NO_STONES);
    expect(html).toContain(essenceFigure(forgeForecast(9, 15, 30, 1).essence));
  });
});
