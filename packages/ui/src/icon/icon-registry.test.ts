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
// Desktop caption buttons (2026-09-08): window-minimize, window-maximize, window-restore,
// window-close — the header draws the window controls itself now, and the four arrive together
// because they are one hairline set read as a group; splitting the close mark off to the existing
// `x-mark` puts two stroke weights in one cluster. Budget 25 -> 29.
// Desktop Heroes tab (2026-09-07): user-group — the seventh nav tab's glyph, chosen over the
// single-figure alternative so it is not read as the Account tab's `user` at the glyph-only
// widths; the budget moved to 30 with it.
// Desktop Optimizer tab (2026-09-11): sparkles — the eighth nav tab's glyph, chosen over sliders,
// a trending arrow and a wrench so it is read as neither Settings, earnings nor Forge at the
// glyph-only widths; the budget moved to 31 with it.
// Desktop PVP tab (2026-09-16): sword — the ninth nav tab's glyph, chosen over crossed swords
// (an X at 16px) and a trophy (achievements) so it reads as a fight beside the Forge hammer; the
// budget moved to 32 with it.
// Desktop Skill Tree tab (2026-09-17): graph — the tenth nav tab's glyph, a hub joined to outlying
// nodes like the game's own tree, chosen over a branching hierarchy (an org chart) and a leafed
// tree (nature) so it reads as connected nodes beside the sparkles; the budget moved to 33 with it.
// Heroes leaderboard (2026-09-25): layout-table — the roster's third layout beside the cards and
// list glyphs, a gridded sheet so it reads as rows-and-columns rather than as the list's bars; the
// budget moved to 34 with it.
// Heroes share card (2026-09-25): share — the desktop roster's opener for the card a player sends
// a friend, the three joined nodes every OS draws for sharing, chosen over `copy` (which already
// means "copy this code" in the same chrome) and an upward arrow out of a box (an export); the
// budget moved to 35 with it.
const MIGRATED_UI_NAMES = [
  'window',
  'signal',
  'map',
  'archive-box',
  'user',
  'cog',
  'hammer',
  'user-group',
  'sparkles',
  'sword',
  'graph',
  'ellipsis-horizontal',
  'layout-grid',
  'layout-list',
  'layout-table',
  'chevron-down',
  'chevron-up',
  'x-mark',
  'swap',
  'check',
  'coffee',
  'copy',
  'share',
  'check-circle',
  'x-circle',
  'exclamation-triangle',
  'information-circle',
  'arrow-path',
  'lock-closed',
  'sort-ascending',
  'sort-descending',
  'window-minimize',
  'window-maximize',
  'window-restore',
  'window-close',
] as const;

describe('icon registries — budget and membership', () => {
  it('keeps uiIconRegistry within the 35-entry budget', () => {
    expect(Object.keys(uiIconRegistry).length).toBeLessThanOrEqual(35);
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
