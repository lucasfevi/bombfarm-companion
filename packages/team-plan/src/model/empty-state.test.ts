import { describe, expect, it } from 'vitest';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { teamPlanEmptyState } from './empty-state';

function hero(id: string, battleAllowed = true): HeroRecord {
  return { id, battleAllowed } as unknown as HeroRecord;
}

const item = {} as never;

describe('teamPlanEmptyState', () => {
  it('is noRoster when there are no heroes, regardless of inventory or scope', () => {
    expect(teamPlanEmptyState([], [item], { a: 'optimize' })).toBe('noRoster');
    expect(teamPlanEmptyState([], [], {})).toBe('noRoster');
  });

  it('is noInventory when there are heroes but no items', () => {
    expect(teamPlanEmptyState([hero('a')], [], {})).toBe('noInventory');
  });

  it('is allLeaveAlone when every hero resolves to a non-optimize scope', () => {
    expect(teamPlanEmptyState([hero('a')], [item], { a: 'donate' })).toBe('allLeaveAlone');
  });

  it('is null once at least one hero is in scope to optimize', () => {
    expect(teamPlanEmptyState([hero('a')], [item], { a: 'optimize' })).toBeNull();
  });

  it('precedence: no roster beats no inventory beats all-leave-alone', () => {
    expect(teamPlanEmptyState([], [], {})).toBe('noRoster');
    expect(teamPlanEmptyState([hero('a', false)], [], {})).toBe('noInventory');
  });
});
