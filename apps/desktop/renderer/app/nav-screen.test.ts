import { describe, expect, it } from 'vitest';
import { navItemsFor } from './nav-items';
import { screenForStripId, stripIdForScreen } from './nav-screen';
import { STRINGS } from '../lib/copy';

describe('the strip item lit for a screen', () => {
  it('lights Progression on both of its pages', () => {
    expect(stripIdForScreen('skills')).toBe('progression');
    expect(stripIdForScreen('collections')).toBe('progression');
  });

  it('lights nothing on Settings, which has no tab', () => {
    expect(stripIdForScreen('settings')).toBeUndefined();
  });

  it('lights every other tab on its own screen', () => {
    for (const id of ['live', 'farm', 'heroes', 'inventory', 'forge', 'optimizer', 'pvp', 'account']) {
      expect(stripIdForScreen(id)).toBe(id);
    }
  });

  it('lights a real strip item for every screen the strip can open', () => {
    const stripIds = navItemsFor(STRINGS.en).map((item) => item.id);
    for (const id of stripIds) {
      expect(stripIds).toContain(stripIdForScreen(screenForStripId(id, 'skills')));
      expect(stripIds).toContain(stripIdForScreen(screenForStripId(id, 'collections')));
    }
  });
});

describe('the screen a pressed strip item opens', () => {
  it('opens Progression on the Skill Tree page by default', () => {
    expect(screenForStripId('progression', 'skills')).toBe('skills');
  });

  it('opens Progression on Collections once Collections was the page last shown', () => {
    expect(screenForStripId('progression', 'collections')).toBe('collections');
  });

  it('opens every other tab on its own screen', () => {
    expect(screenForStripId('farm', 'collections')).toBe('farm');
    expect(screenForStripId('account', 'skills')).toBe('account');
  });
});
