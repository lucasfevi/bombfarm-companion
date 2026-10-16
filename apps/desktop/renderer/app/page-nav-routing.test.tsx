/**
 * A nav item nothing routes to is a tab that silently shows the Live screen instead, which no
 * unit render of `page.tsx` catches — the shell's own hooks reach a preload bridge. The routing
 * is a ternary ladder over JSX with nothing to inject, so unlike the settings handlers it cannot
 * be lifted into a module and executed; the contract is read off the source instead.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STRINGS } from '../lib/copy';
import { navItemsFor } from './nav-items';

const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

/** The last branch is the fallback, and is reached by whichever id nothing else claimed. */
const ROUTED_BY_ID = /activeNavId === '(\w+)'/g;

describe('page.tsx routes every nav item', () => {
  const stripIds = navItemsFor(STRINGS.en).map((item) => item.id);
  const screenIds = [...stripIds.filter((id) => id !== 'progression'), 'skills', 'collections', 'settings'];
  const routed = [...new Set([...source.matchAll(ROUTED_BY_ID)].map((match) => match[1]))];

  it('non-vacuity: the source was read and it does route on the active item', () => {
    expect(routed.length).toBeGreaterThan(2);
  });

  it('gives every screen but the default one a branch of its own, the Progression pages and Settings included', () => {
    expect([...routed].sort()).toEqual(screenIds.filter((id) => id !== 'live').sort());
  });

  it('keys the screen boundary by the active item so a tab change retries', () => {
    expect(source).toContain('<ScreenBoundary screen={activeNavId}>');
  });

  it('renders the Account screen on the Account item', () => {
    expect(source).toContain("activeNavId === 'account' ? (");
    expect(source).toContain('<AccountView');
  });

  it('renders the Progression page on both the Skill Tree and the Collections screens', () => {
    expect(source).toContain("activeNavId === 'skills' || activeNavId === 'collections' ? (");
    expect(source).toContain('<ProgressionPage page={activeNavId}');
  });

  it('opens Settings from the gear and from the update chip through the one handler', () => {
    expect(source).toContain("settingsActive={activeNavId === 'settings'}");
    expect(source.match(/onOpenSettings=\{openSettings\}/g)).toHaveLength(2);
    expect(source).toMatch(/const openSettings = useCallback\(\(\) => \{\s*setActiveNavId\('settings'\);/);
  });

  it('lights the strip item the screen belongs to, and opens a pressed item on its remembered screen', () => {
    expect(source).toContain('const activeStripId = stripIdForScreen(activeNavId);');
    expect(source).toContain('setActiveNavId(screenForStripId(stripId, getProgressionPage()))');
  });

  it('remembers the Progression page whenever the screen becomes one of its pages', () => {
    expect(source).toMatch(/if \(isProgressionPageId\(activeNavId\)\) setProgressionPage\(activeNavId\);/);
  });

  it('lets the holdings inventory column lead to the Inventory tab', () => {
    expect(source).toMatch(/onOpenInventory=\{\(\) => \{\s*setActiveNavId\('inventory'\);/);
  });
});
