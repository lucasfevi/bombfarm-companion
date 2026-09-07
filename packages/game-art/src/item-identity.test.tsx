import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ItemIdentity, type ItemIdentityLabels } from './item-identity';
import type { ItemIconItem } from './item-icon';

const gear: ItemIconItem = { defId: 'iron_anel', rarityIdx: 2, level: 60, upgrade: 12 };

const labels: ItemIdentityLabels<ItemIconItem> = {
  itemName: () => 'Iron · Ring',
  itemRarity: () => 'Rare',
  itemLevel: (item) => `Lv ${item.level}`,
  itemForge: (item) => (item.upgrade > 0 ? `+${item.upgrade}` : ''),
};

function render(props: Parameters<typeof ItemIdentity<ItemIconItem>>[0]) {
  return renderToStaticMarkup(createElement(ItemIdentity<ItemIconItem>, props));
}

/** The order the two lines are read in, with the tags between them stripped out. */
function text(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

describe('ItemIdentity', () => {
  it('reads name then forge, then rarity then level', () => {
    expect(text(render({ item: gear, labels }))).toBe('Iron · Ring +12 Rare · Lv 60');
  });

  it('draws nothing for an unforged piece rather than a +0', () => {
    const html = render({ item: { ...gear, upgrade: 0 }, labels });
    expect(text(html)).toBe('Iron · Ring Rare · Lv 60');
    expect(html).not.toContain('+0');
  });

  /** A key, a house part and a skill stone are named by their tier, so the tier word is empty and
   *  the colour has nowhere to go but the name. */
  it('moves the tier colour onto the name when there is no tier word under it', () => {
    const named = render({ item: gear, labels: { ...labels, itemRarity: () => '' } });
    expect(named).toContain('text-rar-2');
    expect(named).not.toContain('Rare');

    const worded = render({ item: gear, labels });
    expect(worded.slice(0, worded.indexOf('Iron'))).not.toContain('text-rar-2');
  });

  it('drops the second line entirely when an item has neither a tier word nor a level', () => {
    const html = render({
      item: gear,
      labels: { ...labels, itemRarity: () => '', itemLevel: () => '' },
    });
    expect(text(html)).toBe('Iron · Ring +12');
  });
});
