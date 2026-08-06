import { describe, expect, it } from 'vitest';
import { gameIconRegistry } from './game-registry';
import { iconRegistry, iconSources } from './registry';
import { uiIconRegistry } from './ui-registry';

const MIGRATED_UI_NAMES = ['chevron-down', 'chevron-up', 'x-mark', 'coffee'] as const;

describe('icon registries — budget and membership (ICO-11)', () => {
  it('keeps uiIconRegistry within the 24-entry budget', () => {
    expect(Object.keys(uiIconRegistry).length).toBeLessThanOrEqual(24);
  });

  it('maps exactly the four migration ui-chrome glyphs', () => {
    expect(Object.keys(uiIconRegistry).sort()).toEqual([...MIGRATED_UI_NAMES].sort());
  });
});

describe('icon registries — iconSources totality (ICO-12)', () => {
  it('maps every iconRegistry key in iconSources', () => {
    expect(Object.keys(iconSources).sort()).toEqual(Object.keys(iconRegistry).sort());
  });

  it('assigns each name exactly once to ui or game', () => {
    const values = Object.values(iconSources);
    expect(values.every((v) => v === 'ui' || v === 'game')).toBe(true);
    expect(new Set(Object.keys(iconSources)).size).toBe(Object.keys(iconSources).length);
  });
});

describe('icon registries — disjointness (ICO-13)', () => {
  it('keeps ui and game key sets disjoint', () => {
    const uiKeys = new Set(Object.keys(uiIconRegistry));
    const gameKeys = Object.keys(gameIconRegistry);
    const collision = gameKeys.find((key) => uiKeys.has(key));
    expect(collision, `ui and game registries share key "${collision}"`).toBeUndefined();
  });

  it('stores renderable components for every registry entry', () => {
    for (const [name, glyph] of Object.entries(iconRegistry)) {
      expect(typeof glyph, `iconRegistry["${name}"] is not a function`).toBe('function');
    }
  });
});
