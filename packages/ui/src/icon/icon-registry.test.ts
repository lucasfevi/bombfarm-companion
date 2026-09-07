import { describe, expect, it } from 'vitest';
import { iconRegistry, iconSources } from './registry';
import { uiIconRegistry } from './ui-registry';

// m2-toast-settings (2026-08-11): check-circle, x-circle, exclamation-triangle,
// information-circle, arrow-path added — one fixed icon per toast/notification
// variant (success/error/warning/info/progress).
// DeltaTable (2026-08-20): lock-closed added — the shared stat-ledger primitive's
// locked-row glyph, replacing a Chip + HelpTip pair.
// Inventory layout toggle (2026-08-30): layout-grid, layout-list — the cards/list switch is two
// icon buttons rather than two words, so it sits in the toolbar's corner without crowding it.
// Compact Live window (2026-09-01): window — the desktop header's opener for the second window.
// Desktop referral code (2026-09-02): copy — the desktop's top-bar chip and Settings row copy the
// code to the clipboard, and the web already drew this glyph from the vendor package directly.
// Desktop top-bar density (2026-09-02): signal, map, archive-box, user, cog — the five nav tabs
// draw their glyph instead of their word at the narrowest widths; ellipsis-horizontal is the
// overflow trigger the secondary actions collapse into. These six took the registry to its
// 24-entry budget exactly, so the next glyph is a conversation rather than a quiet addition.
// Desktop Forge tab (2026-09-04): hammer — the sixth nav tab's glyph, which is what the
// conversation above was for; the budget moved to 25 with it.
const MIGRATED_UI_NAMES = [
  'window',
  'signal',
  'map',
  'archive-box',
  'user',
  'cog',
  'hammer',
  'ellipsis-horizontal',
  'layout-grid',
  'layout-list',
  'chevron-down',
  'chevron-up',
  'x-mark',
  'swap',
  'check',
  'coffee',
  'copy',
  'check-circle',
  'x-circle',
  'exclamation-triangle',
  'information-circle',
  'arrow-path',
  'lock-closed',
  'sort-ascending',
  'sort-descending',
] as const;

describe('icon registries — budget and membership', () => {
  it('keeps uiIconRegistry within the 25-entry budget', () => {
    expect(Object.keys(uiIconRegistry).length).toBeLessThanOrEqual(25);
  });

  it('maps exactly the declared ui-chrome glyphs', () => {
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
