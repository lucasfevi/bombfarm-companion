import { describe, expect, it } from 'vitest';
import { STRINGS } from '../lib/copy';
import { navItemsFor } from './nav-items';

const t = STRINGS.en;

function idsFor(flavor: Parameters<typeof navItemsFor>[0]): string[] {
  return navItemsFor(flavor, t).map((item) => item.id);
}

describe('navItemsFor', () => {
  it('does not offer Diagnostics in the production flavor', () => {
    expect(idsFor('prod')).toEqual(['planning', 'settings']);
  });

  it('does not offer Diagnostics before the flavor is known, so a shipped build never flashes it', () => {
    expect(idsFor(null)).toEqual(['planning', 'settings']);
  });

  it.each(['dev', 'nightly', 'beta'] as const)('offers Diagnostics in the %s flavor', (flavor) => {
    expect(idsFor(flavor)).toEqual(['planning', 'diagnostics', 'settings']);
  });

  it('always lists Planning first, which the language smoke locates by position', () => {
    for (const flavor of ['prod', 'dev', 'nightly', 'beta', null] as const) {
      expect(idsFor(flavor)[0]).toBe('planning');
    }
  });
});
