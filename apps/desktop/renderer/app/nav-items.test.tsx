import { describe, expect, it } from 'vitest';
import { STRINGS } from '../lib/copy';
import { navItemsFor } from './nav-items';

const t = STRINGS.en;

describe('navItemsFor', () => {
  it('offers exactly Live, Planning, Settings, in that order, in every flavor', () => {
    expect(navItemsFor(t).map((item) => item.id)).toEqual(['live', 'planning', 'settings']);
  });

  it('makes Live the first item, which the language smoke locates by position', () => {
    expect(navItemsFor(t)[0]?.id).toBe('live');
  });
});
