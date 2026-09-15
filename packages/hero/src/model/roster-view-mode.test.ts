import { describe, expect, it } from 'vitest';
import { heroPickOutcome } from './roster-view-mode';

describe('heroPickOutcome', () => {
  it('sends the reader to the detail when picking from the board, which does not show it', () => {
    expect(heroPickOutcome('cards', 'hero-1')).toEqual({ heroId: 'hero-1', showDetail: true });
  });

  it('leaves the reader where they are in the list, which sits beside the detail already', () => {
    expect(heroPickOutcome('list', 'hero-1')).toEqual({ heroId: 'hero-1', showDetail: false });
  });

  it('carries the hero through untouched in both modes', () => {
    // The discriminating case: only the second field differs, so a regression that swapped the
    // two branches would still select the right hero and simply strand the reader.
    expect(heroPickOutcome('cards', 'x').heroId).toBe('x');
    expect(heroPickOutcome('list', 'x').heroId).toBe('x');
  });
});
