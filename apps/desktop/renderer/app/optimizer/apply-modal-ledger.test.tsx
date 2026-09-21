import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { InventoryViewItem } from '@bombfarm/domain/inventory-view';
import { CopyProvider, sub } from '../../lib/copy';
import { en } from '../../lib/copy/en';
import type { ApplyUnitLabel } from '../../lib/optimizer/apply-labels';
import type { UnitStatus } from '../../lib/optimizer/apply-run-reducer';
import { ApplyModalLedgerLine, equipOriginText, pointsLeadText } from './apply-modal-ledger';

function wrap(node: React.ReactNode): string {
  return renderToStaticMarkup(createElement(CopyProvider, { locale: 'en', children: node }));
}

function tagOf(html: string, testid: string): string {
  return new RegExp(`<[a-z]+[^>]*data-testid="${testid}"[^>]*>`).exec(html)?.[0] ?? '';
}

function hero(overrides: Partial<HeroRecord> & { id: string; name: string }): HeroRecord {
  return { rarity: 'raro', level: 40, stars: 0, rank: 'S', skin: 0, ...overrides } as unknown as HeroRecord;
}

function item(overrides: Partial<InventoryViewItem> & { id: string; defId: string }): InventoryViewItem {
  return { rarityIdx: 1, level: 30, upgrade: 5, ...overrides } as unknown as InventoryViewItem;
}

const RESPEC_UNIT: ApplyUnitLabel = {
  index: 0,
  call: 'respec',
  subject: 'Orin',
  from: null,
  to: null,
  points: 173,
  gold: 500,
  heroId: 'h-orin',
  alloc: [
    { stat: 'Attack', points: 73 },
    { stat: 'Speed', points: 2 },
    { stat: 'Crit dmg', points: 98 },
  ],
};

const COMMIT_UNIT: ApplyUnitLabel = {
  index: 1,
  call: 'commit',
  subject: 'Orin',
  from: null,
  to: null,
  points: 147,
  gold: 0,
  heroId: 'h-orin',
  alloc: null,
};

const EQUIP_FROM_BAG: ApplyUnitLabel = {
  index: 2,
  call: 'equip',
  subject: 'Crimson Weapon +5',
  from: null,
  to: 'Orin',
  points: null,
  gold: 0,
  heroId: 'h-orin',
  itemId: 'i-1',
};

const EQUIP_FROM_HERO: ApplyUnitLabel = {
  index: 3,
  call: 'equip',
  subject: 'Crimson Weapon +5',
  from: 'Bellatrix',
  to: 'Orin',
  points: null,
  gold: 0,
  heroId: 'h-orin',
  itemId: 'i-1',
};

const UNEQUIP_UNIT: ApplyUnitLabel = {
  index: 4,
  call: 'unequip',
  subject: 'Old Blade +2',
  from: 'Bram',
  to: null,
  points: null,
  gold: 0,
  heroId: 'h-bram',
  itemId: 'i-2',
};

function renderLine(unit: ApplyUnitLabel, status: UnitStatus = 'ok', overrides: { hero?: HeroRecord | undefined; item?: InventoryViewItem | undefined } = {}) {
  return wrap(createElement(ApplyModalLedgerLine, { unit, status, hero: overrides.hero, item: overrides.item }));
}

describe('pointsLeadText', () => {
  it('reads "respec, then N points" for a respec unit', () => {
    expect(pointsLeadText(RESPEC_UNIT, en)).toBe(sub(en.applyModalLineRespec, { points: 173 }));
  });

  it('reads "place N points" for a commit unit', () => {
    expect(pointsLeadText(COMMIT_UNIT, en)).toBe(sub(en.applyModalLineCommit, { points: 147 }));
  });
});

describe('equipOriginText', () => {
  it('names the Inventory when the call carries no origin hero', () => {
    expect(equipOriginText(EQUIP_FROM_BAG, en)).toBe(sub(en.applyModalFrom, { from: en.applyModalInventory }));
  });

  it('names the origin hero when the call moved the piece off one', () => {
    expect(equipOriginText(EQUIP_FROM_HERO, en)).toBe(sub(en.applyModalFrom, { from: 'Bellatrix' }));
    expect(equipOriginText(UNEQUIP_UNIT, en)).toBe(sub(en.applyModalFrom, { from: 'Bram' }));
  });
});

describe('ApplyModalLedgerLine — shared shell', () => {
  it('carries the ledger-line testid and the status attribute', () => {
    const html = renderLine(RESPEC_UNIT, 'ok');
    const tag = tagOf(html, 'apply-modal-ledger-line');
    expect(tag).toContain('data-unit-status="ok"');
  });

  it('dims a next-up line and leaves a done or sent one full strength', () => {
    const nextTag = tagOf(renderLine(RESPEC_UNIT, 'next'), 'apply-modal-ledger-line');
    expect(nextTag).toContain('opacity-60');
    const sentTag = tagOf(renderLine(RESPEC_UNIT, 'sent'), 'apply-modal-ledger-line');
    expect(sentTag).not.toContain('opacity-60');
  });

  it('draws every mark in its own fixed 16px box regardless of status', () => {
    for (const status of ['ok', 'sent', 'skipped', 'failed', 'next'] as const) {
      const html = renderLine(RESPEC_UNIT, status);
      expect(html).toContain('size-4 shrink-0');
    }
  });
});

describe('ApplyModalLedgerLine — points rows', () => {
  it('draws the hero chip, the lead sentence and one aligned token per stat, never one joined sentence', () => {
    const html = renderLine(RESPEC_UNIT, 'ok', { hero: hero({ id: 'h-orin', name: 'Orin' }) });
    expect(html).toContain('Orin');
    expect(html).toContain(sub(en.applyModalLineRespec, { points: 173 }));
    expect(html).toContain('73');
    expect(html).toContain('Attack');
    expect(html).toContain('2');
    expect(html).toContain('Speed');
    expect(html).toContain('98');
    expect(html).toContain('Crit dmg');
    // the old single joined sentence is gone
    expect(html).not.toContain('73 Attack');
  });

  it('falls back to the unit subject when no hero record resolved', () => {
    const html = renderLine(RESPEC_UNIT, 'ok', { hero: undefined });
    expect(html).toContain('Orin');
  });

  it('renders no stat tokens when the unit carries no allocation', () => {
    const html = renderLine(COMMIT_UNIT, 'ok', { hero: hero({ id: 'h-orin', name: 'Orin' }) });
    expect(html).toContain(sub(en.applyModalLineCommit, { points: 147 }));
    expect(html).not.toContain('bg-bg-2');
  });

  it('lays the row out as a real grid, not a flex row', () => {
    const tag = tagOf(renderLine(RESPEC_UNIT, 'ok'), 'apply-modal-ledger-line');
    expect(tag).toContain('grid');
    expect(tag).toContain('grid-cols-[16px_9rem_10.5rem_minmax(0,1fr)]');
  });
});

describe('ApplyModalLedgerLine — equip rows', () => {
  it('draws the item, an arrow, the destination hero chip and the Inventory origin', () => {
    const html = renderLine(EQUIP_FROM_BAG, 'ok', { hero: hero({ id: 'h-orin', name: 'Orin' }), item: item({ id: 'i-1', defId: 'weapon-1' }) });
    expect(html).toContain('Crimson Weapon +5');
    expect(html).toContain('→');
    expect(html).toContain('Orin');
    expect(html).toContain(en.applyModalInventory);
    expect(html).toContain(sub(en.applyModalFrom, { from: en.applyModalInventory }));
  });

  it('names the origin hero, as plain text, when the piece moved off one', () => {
    const html = renderLine(EQUIP_FROM_HERO, 'ok', { hero: hero({ id: 'h-orin', name: 'Orin' }), item: item({ id: 'i-1', defId: 'weapon-1' }) });
    expect(html).toContain(sub(en.applyModalFrom, { from: 'Bellatrix' }));
  });

  it('draws the item art when an item resolved, and skips it cleanly when none did', () => {
    const withItem = renderLine(EQUIP_FROM_BAG, 'ok', { item: item({ id: 'i-1', defId: 'weapon-1' }) });
    expect((withItem.match(/<img/g) ?? []).length).toBeGreaterThan(0);
    const withoutItem = renderLine(EQUIP_FROM_BAG, 'ok', { item: undefined });
    expect((withoutItem.match(/<img/g) ?? []).length).toBe(0);
    expect(withoutItem).toContain('Crimson Weapon +5');
  });

  it('unequip rows send the piece to the Inventory word, not a hero chip, and name the wearer as the origin', () => {
    const html = renderLine(UNEQUIP_UNIT, 'ok', { hero: hero({ id: 'h-bram', name: 'Bram' }) });
    expect(html).toContain('Old Blade +2');
    expect(html).toContain(en.applyModalInventory);
    expect(html).toContain(sub(en.applyModalFrom, { from: 'Bram' }));
  });

  it('lays the row out with a narrow arrow column between the item and the destination', () => {
    const tag = tagOf(renderLine(EQUIP_FROM_BAG, 'ok'), 'apply-modal-ledger-line');
    expect(tag).toContain('grid-cols-[16px_11rem_1.25rem_minmax(0,1fr)]');
  });
});
