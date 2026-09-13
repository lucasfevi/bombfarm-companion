import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AccountPayload, AccountView } from '@bombfarm/contracts';
import type { InventoryItem } from '@bombfarm/domain/inventory';
import { buildAccountRoster } from '../account/account-roster';
import { heroContentStamp, inventoryContentStamp } from './content-stamp';

const OFFLINE_FIXTURE = path.join(__dirname, '..', '..', '..', 'tests', 'fixtures', 'account-offline.json');

function offlineView(): AccountView {
  const payload = JSON.parse(readFileSync(OFFLINE_FIXTURE, 'utf8')) as AccountPayload;
  return { payload, gameRunning: false, store: { status: 'ok', reason: null, binding: 'better-sqlite3' } };
}

function required<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) throw new Error(message);
  return value;
}

function firstHero() {
  const roster = required(buildAccountRoster(offlineView()), 'expected a roster');
  return required(roster.heroes[0], 'expected a hero');
}

function inventory(): InventoryItem[] {
  return required(buildAccountRoster(offlineView()), 'expected a roster').inventory;
}

describe('heroContentStamp', () => {
  it('is the same for the same hero read twice', () => {
    expect(heroContentStamp(firstHero())).toBe(heroContentStamp(firstHero()));
  });

  it('does not move when only updatedAt changes', () => {
    const hero = firstHero();
    const later = { ...hero, updatedAt: hero.updatedAt + 60_000 };
    expect(heroContentStamp(later)).toBe(heroContentStamp(hero));
  });

  it('moves when the level changes', () => {
    const hero = firstHero();
    const leveled = { ...hero, level: hero.level + 1 };
    expect(heroContentStamp(leveled)).not.toBe(heroContentStamp(hero));
  });

  it('is unaffected by the object\'s own key order', () => {
    const hero = firstHero();
    const reordered = Object.fromEntries(Object.entries(hero).reverse()) as typeof hero;
    expect(heroContentStamp(reordered)).toBe(heroContentStamp(hero));
  });

  it('is a non-negative 32-bit integer', () => {
    const stamp = heroContentStamp(firstHero());
    expect(Number.isInteger(stamp)).toBe(true);
    expect(stamp).toBeGreaterThanOrEqual(0);
    expect(stamp).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('inventoryContentStamp', () => {
  it('is stable for an empty inventory', () => {
    expect(inventoryContentStamp([])).toBe(inventoryContentStamp([]));
  });

  it('moves when one item\'s upgrade level changes', () => {
    const items = inventory();
    const first = required(items[0], 'expected an item');
    const upgraded = items.map((item, index) => (index === 0 ? { ...first, upgrade: first.upgrade + 1 } : item));
    expect(inventoryContentStamp(upgraded)).not.toBe(inventoryContentStamp(items));
  });
});
