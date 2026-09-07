import { describe, expect, it } from 'vitest';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { RosterHeroRow } from './hero-roster-order';
import { defaultSelectedHeroId, resolveSelectedHeroId, selectedRow } from './hero-selection';

/** Only `id` is read by these three rules, so the row carries nothing else it does not need. */
function row(id: string): RosterHeroRow {
  return { id, hero: { id } as HeroRecord, report: undefined };
}

const ORDERED = [row('best'), row('middle'), row('worst')];

describe('defaultSelectedHeroId', () => {
  it('selects the hero at the top of the list', () => {
    expect(defaultSelectedHeroId(ORDERED)).toBe('best');
  });

  it('has nothing to select on an empty roster', () => {
    expect(defaultSelectedHeroId([])).toBeNull();
  });
});

describe('resolveSelectedHeroId', () => {
  it('selects a hero when the screen opens with nothing selected, never leaving the detail pane empty', () => {
    expect(resolveSelectedHeroId(null, ORDERED)).toBe('best');
  });

  it('keeps the selected hero across a refresh that reordered the list', () => {
    const reordered = [row('worst'), row('best'), row('middle')];
    expect(resolveSelectedHeroId('middle', reordered)).toBe('middle');
  });

  it('keeps the selected hero by identity, not by the position it held', () => {
    // The account grew a hero above the selected one. Holding position 1 would silently move the
    // screen onto 'best'; holding identity keeps it on the hero the player chose.
    const grown = [row('newcomer'), ...ORDERED];
    expect(resolveSelectedHeroId('middle', grown)).toBe('middle');
    expect(grown[1]?.id).toBe('best');
  });

  it('falls back to the top of the list when the selected hero is gone from the account', () => {
    expect(resolveSelectedHeroId('middle', [row('best'), row('worst')])).toBe('best');
  });

  it('holds nothing when the roster arrived empty', () => {
    expect(resolveSelectedHeroId('middle', [])).toBeNull();
  });
});

describe('selectedRow', () => {
  it('finds the row the selection names', () => {
    expect(selectedRow('middle', ORDERED)?.id).toBe('middle');
  });

  it('finds nothing for a selection the roster does not carry', () => {
    expect(selectedRow('gone', ORDERED)).toBeNull();
    expect(selectedRow(null, ORDERED)).toBeNull();
  });
});
