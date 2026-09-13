import { describe, expect, it } from 'vitest';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { groupHeroesByScope, resolveDropScope, SCOPE_COLUMNS } from './scope-board';

function hero(id: string, battleAllowed = true): HeroRecord {
  return { id, battleAllowed } as unknown as HeroRecord;
}

describe('SCOPE_COLUMNS', () => {
  it('lists the three columns in board order', () => {
    expect(SCOPE_COLUMNS).toEqual(['optimize', 'donate', 'leaveAlone']);
  });
});

describe('resolveDropScope', () => {
  it('resolves a drop onto a column by its column data', () => {
    expect(resolveDropScope('donate', { type: 'column', scope: 'donate' }, {})).toBe('donate');
  });

  it('resolves a drop onto a hero card by its carried scope data', () => {
    expect(resolveDropScope('hero-a', { type: 'hero', scope: 'leaveAlone' }, {})).toBe('leaveAlone');
  });

  it('resolves a drop by a bare column id when no data is carried', () => {
    expect(resolveDropScope('optimize', null, {})).toBe('optimize');
  });

  it('resolves a drop onto a hero id by looking up its current scope', () => {
    expect(resolveDropScope('hero-a', null, { 'hero-a': 'donate' })).toBe('donate');
  });

  it('is null when the target is neither a scope column nor a known hero', () => {
    expect(resolveDropScope('unknown', null, {})).toBeNull();
  });
});

describe('groupHeroesByScope', () => {
  it('resolves each hero to its stored or default scope, and groups by column', () => {
    const heroes = [hero('a'), hero('b', false), hero('c')];
    const { resolved, byColumn } = groupHeroesByScope(heroes, { c: 'leaveAlone' });
    expect(resolved).toEqual({ a: 'optimize', b: 'donate', c: 'leaveAlone' });
    expect(byColumn.optimize.map((h) => h.id)).toEqual(['a']);
    expect(byColumn.donate.map((h) => h.id)).toEqual(['b']);
    expect(byColumn.leaveAlone.map((h) => h.id)).toEqual(['c']);
  });
});
