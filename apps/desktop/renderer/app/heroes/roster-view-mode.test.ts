import { describe, expect, it } from 'vitest';
import { heroPickOutcome, nextRosterViewMode, rosterToggleLabel } from './roster-view-mode';

describe('nextRosterViewMode', () => {
  it('swaps the two presentations', () => {
    expect(nextRosterViewMode('rail')).toBe('board');
    expect(nextRosterViewMode('board')).toBe('rail');
  });

  it('returns to where it started after two presses', () => {
    expect(nextRosterViewMode(nextRosterViewMode('rail'))).toBe('rail');
    expect(nextRosterViewMode(nextRosterViewMode('board'))).toBe('board');
  });
});

describe('rosterToggleLabel', () => {
  const labels = { rail: 'List', board: 'Cards' };

  it('names the mode the press would take you to, not the one you are in', () => {
    expect(rosterToggleLabel('rail', labels)).toBe('Cards');
    expect(rosterToggleLabel('board', labels)).toBe('List');
  });
});

describe('heroPickOutcome', () => {
  it('sends the reader to the detail when picking from the board, which does not show it', () => {
    expect(heroPickOutcome('board', 'hero-1')).toEqual({ heroId: 'hero-1', showDetail: true });
  });

  it('leaves the reader where they are on the rail, which sits beside the detail already', () => {
    expect(heroPickOutcome('rail', 'hero-1')).toEqual({ heroId: 'hero-1', showDetail: false });
  });

  it('carries the hero through untouched in both modes', () => {
    // The discriminating case: only the second field differs, so a regression that swapped the
    // two branches would still select the right hero and simply strand the reader.
    expect(heroPickOutcome('board', 'x').heroId).toBe('x');
    expect(heroPickOutcome('rail', 'x').heroId).toBe('x');
  });
});
