import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { teamPlanEn, type TeamPlanScreenCopy } from '../copy';
import type { GearFlowRow } from '../model/gear-flow-rows';
import { HeroForgeQueue, type ForgeQueueAction, type ForgeQueueEntryRef } from './hero-forge-queue';

const copy = {
  ...teamPlanEn,
  rankLv: 'Lv',
} as unknown as TeamPlanScreenCopy;

function forgeRow(itemId: string, from: number, to: number): GearFlowRow {
  return {
    itemId,
    defId: 'set_bota_1',
    slot: 'bota',
    rarityIdx: 0,
    level: 10,
    upgrade: from,
    forge: { from, to },
    originHeroId: 'hero-1',
    destHeroId: 'hero-1',
  };
}

function render(rows: GearFlowRow[], action?: ForgeQueueAction) {
  return renderToStaticMarkup(createElement(HeroForgeQueue, { t: copy, lang: 'en', rows, action }));
}

describe('HeroForgeQueue — the host action slot', () => {
  const rows = [forgeRow('item-a', 8, 12), forgeRow('item-b', 0, 8)];

  it('renders nothing for the slot when the host supplies no action', () => {
    const html = render(rows);
    expect(html).not.toContain('data-testid="host-action"');
    expect(html.split('data-testid="team-plan-forge-queue-item"').length - 1).toBe(2);
  });

  it('calls the action once per entry with the piece and its climb, and draws what it returns', () => {
    const seen: ForgeQueueEntryRef[] = [];
    const html = render(rows, (entry) => {
      seen.push(entry);
      return createElement('button', { 'data-testid': 'host-action' }, entry.itemId);
    });
    expect(seen).toEqual([
      { itemId: 'item-a', from: 8, to: 12 },
      { itemId: 'item-b', from: 0, to: 8 },
    ]);
    expect(html.split('data-testid="host-action"').length - 1).toBe(2);
  });
});
