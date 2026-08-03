import { describe, expect, it } from 'vitest';
import { barRecipe, trackClass } from '@bombfarm/ui/bar.recipe';

/**
 * Class-string parity guard for the ranking bar migrated from `bar-chrome.ts`.
 * Legacy strings captured here as the parity source of truth.
 */
describe('bar recipe parity', () => {
  it('preserves the track class', () => {
    expect(trackClass).toBe('h-2 overflow-hidden bg-bg');
  });

  it('emits the default fill', () => {
    expect(barRecipe({ variant: 'fill' })).toBe(
      'h-full bg-[color-mix(in_oklch,var(--accent)_45%,var(--bg-2))]',
    );
  });

  it('emits the best fill', () => {
    expect(barRecipe({ variant: 'best' })).toBe('h-full bg-accent');
  });

  it('defaults to the fill variant', () => {
    expect(barRecipe()).toBe('h-full bg-[color-mix(in_oklch,var(--accent)_45%,var(--bg-2))]');
  });
});
