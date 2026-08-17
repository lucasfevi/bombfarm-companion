import { describe, expect, it } from 'vitest';
import { iconRegistry, iconSources } from './registry';
import { uiIconRegistry } from './ui-registry';

// m2-toast-settings (2026-08-11): check-circle, x-circle, exclamation-triangle,
// information-circle, arrow-path added — one fixed icon per toast/notification
// variant (success/error/warning/info/progress), TST-13.
const MIGRATED_UI_NAMES = [
  'chevron-down',
  'chevron-up',
  'x-mark',
  'coffee',
  'check-circle',
  'x-circle',
  'exclamation-triangle',
  'information-circle',
  'arrow-path',
] as const;

describe('icon registries — budget and membership', () => {
  it('keeps uiIconRegistry within the 24-entry budget', () => {
    expect(Object.keys(uiIconRegistry).length).toBeLessThanOrEqual(24);
  });

  it('maps exactly the nine ui-chrome glyphs', () => {
    expect(Object.keys(uiIconRegistry).sort()).toEqual([...MIGRATED_UI_NAMES].sort());
  });

  it('exposes the same keys via iconRegistry', () => {
    expect(Object.keys(iconRegistry).sort()).toEqual([...MIGRATED_UI_NAMES].sort());
  });
});

describe('icon registries — iconSources totality', () => {
  it('maps every iconRegistry key in iconSources as ui', () => {
    expect(Object.keys(iconSources).sort()).toEqual(Object.keys(iconRegistry).sort());
    expect(Object.values(iconSources).every((v) => v === 'ui')).toBe(true);
  });

  it('stores renderable components for every registry entry', () => {
    for (const [name, glyph] of Object.entries(iconRegistry)) {
      expect(typeof glyph, `iconRegistry["${name}"] is not a function`).toBe('function');
    }
  });
});
