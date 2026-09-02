import { describe, expect, it } from 'vitest';
import { STRINGS } from '../lib/copy';
import { navItemsFor } from './nav-items';

const t = STRINGS.en;

describe('navItemsFor', () => {
  it('offers exactly Live, Farm, Inventory, Account, Settings, in that order, in every flavor', () => {
    expect(navItemsFor(t).map((item) => item.id)).toEqual([
      'live',
      'farm',
      'inventory',
      'account',
      'settings',
    ]);
  });

  it('makes Live the first item, which the language smoke locates by position', () => {
    expect(navItemsFor(t)[0]?.id).toBe('live');
  });

  it('puts Account after Inventory and leaves Settings last, the way the web planner orders them', () => {
    const ids = navItemsFor(t).map((item) => item.id);
    expect(ids.indexOf('account')).toBe(ids.indexOf('inventory') + 1);
    expect(ids.at(-1)).toBe('settings');
  });

  it('labels every item, in both languages', () => {
    for (const copy of Object.values(STRINGS)) {
      expect(navItemsFor(copy).map((item) => item.label)).not.toContain(undefined);
    }
  });
});
