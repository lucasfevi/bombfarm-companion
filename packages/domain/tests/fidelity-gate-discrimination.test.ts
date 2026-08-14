/**
 * MP2 F4 — the discrimination (mutation) suite. Anti-self-greening device 3 (design §5): eight
 * committed-pair mutants, each a deep clone mutated in memory (the loaded fixture itself is
 * never mutated), each asserted to fail `runFidelityGate` with a specific `error.code` AND
 * specific message substrings — asserting only a message would let a mutant die for the wrong
 * reason (design §4.5).
 */
import { describe, expect, it, vi } from 'vitest';
import { loadFidelityPair, type FidelityPair } from './helpers/fidelity-pair';
import { runFidelityGate } from './helpers/fidelity-gate';
import { FidelityGateError } from './helpers/fidelity-gate-error';

/**
 * The real committed pair. MP5 F1 (design.md §8): re-pointed onto the post-patch pair — the
 * mutation target must be a GEARED hero (mutant 1 raises a gear level, and there is no gear to
 * raise on a naked hero). `Bellatrix` (sourceId `20402`, 8/8 geared) replaces the deleted
 * fixture's `Bram`.
 */
const BRAM_ID = '20402';
const BRAM_ITEM_DEF_ID = 'wooden_arma';

function mutatedPair(mutate: (pair: FidelityPair) => void): FidelityPair {
  // structuredClone, never mutate the loaded fixture in place (T6's Done-when).
  const pair = structuredClone(loadFidelityPair());
  mutate(pair);
  return pair;
}

function expectFidelityError(fn: () => unknown, code: string): FidelityGateError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(FidelityGateError);
    expect((err as FidelityGateError).code).toBe(code);
    return err as FidelityGateError;
  }
  throw new Error(`expected fn to throw FidelityGateError(${code}), but it did not throw`);
}

/** Declared once, checked by the meta-test below — a silently deleted mutant fails the suite. */
const DECLARED_MUTANT_COUNT = 8;
const executedMutants: string[] = [];

describe('fidelity gate discrimination — eight committed-pair mutants', () => {
  it('mutant 1/8: gear level +1 on one hero -> heroStatMismatch naming that hero and the affected stat key', () => {
    executedMutants.push('gear-level-bump');
    const pair = mutatedPair((p) => {
      const items = p.livePayload.items as Array<Record<string, unknown>>;
      const item = items.find((it) => it.equipped_on === BRAM_ID && it.def_id === BRAM_ITEM_DEF_ID);
      expect(item).toBeDefined();
      (item as Record<string, unknown>).level = ((item as Record<string, unknown>).level as number) + 40;
    });
    const err = expectFidelityError(() => runFidelityGate(pair), 'heroStatMismatch');
    expect(err.message).toContain('Bellatrix');
    expect(err.message).toContain('gearedOverride');
  });

  it('mutant 2/8: account.gold coerced to a string -> fails (the spec\'s first named hazard)', () => {
    executedMutants.push('gold-coerced');
    const pair = mutatedPair((p) => {
      const account = p.livePayload.account as Record<string, unknown>;
      expect(typeof account.gold).toBe('string');
      account.gold = Number(account.gold);
    });
    const err = expectFidelityError(() => runFidelityGate(pair), 'accountMismatch');
    expect(err.message).toContain('account.gold');
  });

  it('mutant 3/8: one stat_ranges bound dropped from one hero -> fails naming that hero', () => {
    executedMutants.push('stat-ranges-dropped');
    const pair = mutatedPair((p) => {
      const heroes = p.livePayload.heroes as Array<Record<string, unknown>>;
      const hero = heroes.find((h) => h.id === BRAM_ID) as Record<string, unknown>;
      const statRanges = hero.stat_ranges as Record<string, unknown>;
      delete statRanges.luck;
    });
    const err = expectFidelityError(() => runFidelityGate(pair), 'heroStatMismatch');
    expect(err.message).toContain('Bellatrix');
    expect(err.message).toContain('stat_ranges');
  });

  it('mutant 4/8: one hero object truncated one brace too shallow (a nested sub-object lifted out) -> fails naming that hero', () => {
    executedMutants.push('hero-truncated');
    const pair = mutatedPair((p) => {
      const heroes = p.livePayload.heroes as Array<Record<string, unknown>>;
      const hero = heroes.find((h) => h.id === BRAM_ID) as Record<string, unknown>;
      const statRanges = hero.stat_ranges as Record<string, Record<string, unknown>>;
      // Lifts crit_chance's own {min, max} up to replace the whole stat_ranges object — the
      // extraction stopped one brace too shallow, exactly the hazard the spec names.
      hero.stat_ranges = statRanges.crit_chance;
    });
    const err = expectFidelityError(() => runFidelityGate(pair), 'heroStatMismatch');
    expect(err.message).toContain('Bellatrix');
  });

  it('mutant 5/8: one hero appended to the live capture -> rosterMismatch, live-only, zero heroes compared', () => {
    executedMutants.push('hero-appended');
    const onHeroCompared = vi.fn();
    const pair = mutatedPair((p) => {
      const heroes = p.livePayload.heroes as Array<Record<string, unknown>>;
      const ghost = structuredClone(heroes[0]) as Record<string, unknown>;
      ghost.id = '999999';
      ghost.name = 'GhostHero';
      heroes.push(ghost);
    });
    const err = expectFidelityError(() => runFidelityGate(pair, { onHeroCompared }), 'rosterMismatch');
    expect(err.message).toContain('live-only');
    expect(err.message).toContain('GhostHero');
    expect(onHeroCompared).not.toHaveBeenCalled();
  });

  it('mutant 6/8: one hero removed from the live capture -> rosterMismatch, export-only, zero heroes compared', () => {
    executedMutants.push('hero-removed');
    const onHeroCompared = vi.fn();
    const pair = mutatedPair((p) => {
      const heroes = p.livePayload.heroes as Array<Record<string, unknown>>;
      heroes.pop();
    });
    const err = expectFidelityError(() => runFidelityGate(pair, { onHeroCompared }), 'rosterMismatch');
    expect(err.message).toContain('export-only');
    expect(onHeroCompared).not.toHaveBeenCalled();
  });

  it('mutant 7/8: every hero sourceId rewritten -> rosterMismatch (the "different accounts" edge case)', () => {
    executedMutants.push('sourceid-rewritten');
    const onHeroCompared = vi.fn();
    const pair = mutatedPair((p) => {
      const heroes = p.livePayload.heroes as Array<Record<string, unknown>>;
      for (const hero of heroes) hero.id = `rw-${hero.id as string}`;
    });
    const err = expectFidelityError(() => runFidelityGate(pair, { onHeroCompared }), 'rosterMismatch');
    expect(err.message).toContain('live-only');
    expect(err.message).toContain('export-only');
    expect(onHeroCompared).not.toHaveBeenCalled();
  });

  it('mutant 8/8: casa.active_casa changed -> accountMismatch naming houseIdx', () => {
    executedMutants.push('casa-active-casa-changed');
    const pair = mutatedPair((p) => {
      const casa = p.livePayload.casa as Record<string, unknown>;
      casa.active_casa = (casa.active_casa as number) + 1;
    });
    const err = expectFidelityError(() => runFidelityGate(pair), 'accountMismatch');
    expect(err.message).toContain('account.houseIdx');
  });

  it('meta: the mutant list length matches the declared constant — a silently deleted mutant fails this suite', () => {
    expect(executedMutants.length).toBe(DECLARED_MUTANT_COUNT);
    expect(new Set(executedMutants).size).toBe(DECLARED_MUTANT_COUNT);
  });
});
