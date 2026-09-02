/**
 * A nav item nothing routes to is a tab that silently shows the Live screen instead, which no
 * unit render of `page.tsx` catches — the shell's own hooks reach a preload bridge. So the
 * contract is checked against the source, the way the other `page-*-wiring` guards are.
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
  const ids = navItemsFor(STRINGS.en).map((item) => item.id);
  const routed = [...source.matchAll(ROUTED_BY_ID)].map((match) => match[1]);

  it('non-vacuity: the source was read and it does route on the active item', () => {
    expect(routed.length).toBeGreaterThan(2);
  });

  it('gives every item but the default one a branch of its own', () => {
    expect([...routed].sort()).toEqual(ids.filter((id) => id !== 'live').sort());
  });

  it('renders the Account screen on the Account item', () => {
    expect(source).toContain("activeNavId === 'account' ? (");
    expect(source).toContain('<AccountView');
  });

  it('lets the holdings inventory column lead to the Inventory tab', () => {
    expect(source).toMatch(/onOpenInventory=\{\(\) => \{\s*setActiveNavId\('inventory'\);/);
  });
});
