import { describe, expect, it } from 'vitest';
import { STRINGS } from '../lib/copy';
import { navItemsFor } from './nav-items';

const t = STRINGS.en;
const HIDDEN = { premium: false };
const SHOWN = { premium: true };

describe('navItemsFor', () => {
  it('offers exactly Live, Farm, Heroes, Inventory, Forge, Optimizer, PVP, Progression, Account, in that order, in every flavor', () => {
    for (const copy of Object.values(STRINGS)) {
      expect(navItemsFor(copy, HIDDEN).map((item) => item.id)).toEqual([
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
    const ids = navItemsFor(t, HIDDEN).map((item) => item.id);
    expect(ids).not.toContain('skills');
    expect(ids).not.toContain('collections');
    expect(ids).not.toContain('settings');
  });

  it('makes Live the first item, which the language smoke locates by position', () => {
    expect(navItemsFor(t, HIDDEN)[0]?.id).toBe('live');
  });

  it('puts Heroes after Farm, Forge after Inventory, Optimizer after Forge, PVP after Optimizer, Progression after PVP and Account after Progression', () => {
    const ids = navItemsFor(t, HIDDEN).map((item) => item.id);
    expect(ids.indexOf('heroes')).toBe(ids.indexOf('farm') + 1);
    expect(ids.indexOf('forge')).toBe(ids.indexOf('inventory') + 1);
    expect(ids.indexOf('optimizer')).toBe(ids.indexOf('forge') + 1);
    expect(ids.indexOf('pvp')).toBe(ids.indexOf('optimizer') + 1);
    expect(ids.indexOf('progression')).toBe(ids.indexOf('pvp') + 1);
    expect(ids.at(-1)).toBe('account');
  });

  it('labels Progression "Progression" in English and "Progressão" in Portuguese, with the graph glyph', () => {
    const progression = (copy: typeof t) => navItemsFor(copy, HIDDEN).find((item) => item.id === 'progression');
    expect(progression(STRINGS.en)?.label).toBe('Progression');
    expect(progression(STRINGS['pt-BR'])?.label).toBe('Progressão');
    expect(progression(t)?.icon).toBe('graph');
  });

  it('gives every item a glyph, which the narrow bar draws alone', () => {
    for (const item of navItemsFor(t, HIDDEN)) expect(item.icon).toBeTruthy();
  });

  it('labels every item, in both languages', () => {
    for (const copy of Object.values(STRINGS)) {
      expect(navItemsFor(copy, HIDDEN).map((item) => item.label)).not.toContain(undefined);
    }
  });

  it('offers the same nine, unchanged, while Premium is hidden', () => {
    expect(navItemsFor(t, HIDDEN).map((item) => item.id)).not.toContain('premium');
    expect(navItemsFor(t, HIDDEN)).toHaveLength(9);
  });

  it('inserts Premium after Progression and before Account when shown', () => {
    for (const copy of Object.values(STRINGS)) {
      expect(navItemsFor(copy, SHOWN).map((item) => item.id)).toEqual([
        'live',
        'farm',
        'heroes',
        'inventory',
        'forge',
        'optimizer',
        'pvp',
        'progression',
        'premium',
        'account',
      ]);
    }
  });

  it('labels Premium "Premium" in both languages, with the star glyph', () => {
    for (const copy of Object.values(STRINGS)) {
      const premium = navItemsFor(copy, SHOWN).find((item) => item.id === 'premium');
      expect(premium?.label).toBe('Premium');
      expect(premium?.label).toBe(copy.premiumNavLabel);
      expect(premium?.icon).toBe('star');
    }
  });

  it('leaves every other item exactly as it is when Premium is shown', () => {
    const others = navItemsFor(t, SHOWN).filter((item) => item.id !== 'premium');

    expect(others).toEqual(navItemsFor(t, HIDDEN));
  });
});
