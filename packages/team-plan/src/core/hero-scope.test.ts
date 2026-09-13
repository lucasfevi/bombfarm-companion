import { describe, expect, it } from 'vitest';
import {
  buildDefaultScopeMap,
  countOptimizeScopeHeroes,
  defaultScopeForHero,
  heroScopeKey,
  mergeScopeForRoster,
  resolveHeroScope,
} from './hero-scope';

describe('defaultScopeForHero', () => {
  it('donates a battle-disabled hero', () => {
    expect(defaultScopeForHero(false)).toBe('donate');
  });

  it('optimizes a battle-allowed hero', () => {
    expect(defaultScopeForHero(true)).toBe('optimize');
  });

  it('optimizes when battleAllowed is undefined — undefined is not false', () => {
    expect(defaultScopeForHero(undefined)).toBe('optimize');
  });
});

describe('resolveHeroScope', () => {
  it('prefers the stored choice over the default', () => {
    const hero = { id: 'a', battleAllowed: false };
    expect(resolveHeroScope(hero, { a: 'optimize' })).toBe('optimize');
  });

  it('falls back to the default when no choice is stored', () => {
    const hero = { id: 'a', battleAllowed: false };
    expect(resolveHeroScope(hero, {})).toBe('donate');
  });
});

describe('buildDefaultScopeMap', () => {
  it('defaults battleAllowed false heroes to donate scope', () => {
    const scope = buildDefaultScopeMap([
      { id: 'a', battleAllowed: true },
      { id: 'b', battleAllowed: false },
    ]);
    expect(scope).toEqual({ a: 'optimize', b: 'donate' });
  });
});

describe('mergeScopeForRoster', () => {
  it('keeps stored choices, seeds defaults for new heroes, and drops heroes gone from the roster', () => {
    const merged = mergeScopeForRoster(
      [
        { id: 'a', battleAllowed: true },
        { id: 'b', battleAllowed: false },
      ],
      { a: 'leaveAlone', ghost: 'donate' },
    );
    expect(merged).toEqual({ a: 'leaveAlone', b: 'donate' });
  });

  it('does not reset an explicit Optimize on a battle-disabled hero', () => {
    const merged = mergeScopeForRoster([{ id: 'a', battleAllowed: false }], { a: 'optimize' });
    expect(merged).toEqual({ a: 'optimize' });
  });
});

describe('countOptimizeScopeHeroes', () => {
  it('counts only heroes resolved to optimize', () => {
    const heroes = [
      { id: 'a', battleAllowed: true },
      { id: 'b', battleAllowed: false },
      { id: 'c', battleAllowed: true },
    ];
    expect(countOptimizeScopeHeroes(heroes, { c: 'donate' })).toBe(1);
  });
});

describe('heroScopeKey', () => {
  it('prefers sourceId when present', () => {
    expect(heroScopeKey({ id: 'a', sourceId: 'src-a' })).toBe('src-a');
  });

  it('falls back to id when sourceId is absent', () => {
    expect(heroScopeKey({ id: 'a' })).toBe('a');
  });
});
