import { describe, expect, it } from 'vitest';
import { rosterCombatFacts } from './roster-facts.js';

const hero = (overrides: Record<string, unknown> = {}) => ({
  id: 'h1',
  stats: { cooldown_reduction: 0.25 },
  abilities: [{ code: 'fantasma', level: 3 }],
  ...overrides,
});

describe('rosterCombatFacts', () => {
  it('reads the id, the cooldown reduction and the Fantasma flag of a well-formed hero', () => {
    expect(rosterCombatFacts([hero()])).toEqual([{ id: 'h1', cooldownReduction: 0.25, carriesFantasma: true }]);
  });

  it('keeps the boundary values 0 and 1 as valid cooldown reductions', () => {
    const facts = rosterCombatFacts([hero({ id: 'a', stats: { cooldown_reduction: 0 } }), hero({ id: 'b', stats: { cooldown_reduction: 1 } })]);
    expect(facts.map((fact) => fact.cooldownReduction)).toEqual([0, 1]);
  });

  it.each([
    ['missing stats', { stats: undefined }],
    ['missing cooldown_reduction', { stats: {} }],
    ['NaN', { stats: { cooldown_reduction: Number.NaN } }],
    ['infinite', { stats: { cooldown_reduction: Number.POSITIVE_INFINITY } }],
    ['negative', { stats: { cooldown_reduction: -0.1 } }],
    ['above 1', { stats: { cooldown_reduction: 1.0001 } }],
    ['a string', { stats: { cooldown_reduction: '0.2' } }],
  ])('leaves the cooldown reduction absent when it is %s', (_label, overrides) => {
    const [fact] = rosterCombatFacts([hero(overrides)]);
    expect(fact).toEqual({ id: 'h1', carriesFantasma: true });
    expect('cooldownReduction' in (fact as object)).toBe(false);
  });

  it('does not count Fantasma at level 0', () => {
    const [fact] = rosterCombatFacts([hero({ abilities: [{ code: 'fantasma', level: 0 }] })]);
    expect(fact?.carriesFantasma).toBe(false);
  });

  it('counts Fantasma at any level above 0 among other abilities', () => {
    const [fact] = rosterCombatFacts([hero({ abilities: [{ code: 'other', level: 5 }, { code: 'fantasma', level: 1 }] })]);
    expect(fact?.carriesFantasma).toBe(true);
  });

  it('does not count a different ability code', () => {
    const [fact] = rosterCombatFacts([hero({ abilities: [{ code: 'detonacao_dupla', level: 4 }] })]);
    expect(fact?.carriesFantasma).toBe(false);
  });

  it.each([
    ['abilities missing', { abilities: undefined }],
    ['abilities not an array', { abilities: 'fantasma' }],
    ['ability entries malformed', { abilities: [null, 7, 'fantasma', { code: 'fantasma' }, { code: 'fantasma', level: '2' }] }],
  ])('treats %s as not carrying Fantasma', (_label, overrides) => {
    const [fact] = rosterCombatFacts([hero(overrides)]);
    expect(fact?.carriesFantasma).toBe(false);
  });

  it('skips a hero without a string id', () => {
    expect(rosterCombatFacts([hero({ id: undefined }), hero({ id: 7 }), hero({ id: 'kept' })]).map((fact) => fact.id)).toEqual(['kept']);
  });

  it('skips entries that are not objects', () => {
    expect(rosterCombatFacts([null, undefined, 'x', 4, hero()]).map((fact) => fact.id)).toEqual(['h1']);
  });

  it('returns an empty list for empty input and for input that is not an array', () => {
    expect(rosterCombatFacts([])).toEqual([]);
    expect(rosterCombatFacts(undefined as unknown as unknown[])).toEqual([]);
  });

  it('keeps every well-formed hero in input order', () => {
    expect(rosterCombatFacts([hero({ id: 'z' }), hero({ id: 'a' })]).map((fact) => fact.id)).toEqual(['z', 'a']);
  });
});
