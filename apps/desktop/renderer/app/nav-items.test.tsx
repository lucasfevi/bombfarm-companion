import { describe, expect, it } from 'vitest';
import { STRINGS } from '../lib/copy';
import { navItemsFor } from './nav-items';

const t = STRINGS.en;

describe('navItemsFor', () => {
  it('offers exactly Live, Farm, Heroes, Inventory, Forge, Optimizer, PVP, Progression, Account, in that order, in every flavor', () => {
    for (const copy of Object.values(STRINGS)) {
      expect(navItemsFor(copy).map((item) => item.id)).toEqual([
        'live',
        'farm',
        'heroes',
        'inventory',
        'forge',
        'optimizer',
        'pvp',
        'progression',
        'account',
      ]);
    }
  });

  it('keeps Skill Tree, Collections and Settings out of the strip', () => {
    const ids = navItemsFor(t).map((item) => item.id);
    expect(ids).not.toContain('skills');
    expect(ids).not.toContain('collections');
    expect(ids).not.toContain('settings');
  });

  it('makes Live the first item, which the language smoke locates by position', () => {
    expect(navItemsFor(t)[0]?.id).toBe('live');
  });

  it('puts Heroes after Farm, Forge after Inventory, Optimizer after Forge, PVP after Optimizer, Progression after PVP and Account after Progression', () => {
    const ids = navItemsFor(t).map((item) => item.id);
    expect(ids.indexOf('heroes')).toBe(ids.indexOf('farm') + 1);
    expect(ids.indexOf('forge')).toBe(ids.indexOf('inventory') + 1);
    expect(ids.indexOf('optimizer')).toBe(ids.indexOf('forge') + 1);
    expect(ids.indexOf('pvp')).toBe(ids.indexOf('optimizer') + 1);
    expect(ids.indexOf('progression')).toBe(ids.indexOf('pvp') + 1);
    expect(ids.at(-1)).toBe('account');
  });

  it('labels Progression "Progression" in English and "Progressão" in Portuguese, with the graph glyph', () => {
    const progression = (copy: typeof t) => navItemsFor(copy).find((item) => item.id === 'progression');
    expect(progression(STRINGS.en)?.label).toBe('Progression');
    expect(progression(STRINGS['pt-BR'])?.label).toBe('Progressão');
    expect(progression(t)?.icon).toBe('graph');
  });

  it('gives every item a glyph, which the narrow bar draws alone', () => {
    for (const item of navItemsFor(t)) expect(item.icon).toBeTruthy();
  });

  it('labels every item, in both languages', () => {
    for (const copy of Object.values(STRINGS)) {
      expect(navItemsFor(copy).map((item) => item.label)).not.toContain(undefined);
    }
  });
});
