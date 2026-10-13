import { describe, expect, it } from 'vitest';
import { diagnoseObservedBodyDrift, identifyObservedBody } from '../identify-observed-body.js';
import { wireKey, type PhaseEconomyWireSymbol } from './lexicon.js';
import { isPhaseEconomyBody, readPhaseEconomy } from './parse.js';

/** Two bodies of one burst as the server sent them, an ordinary phase and a gate phase. */
function ordinaryPhaseBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    [wireKey('phase')]: 1,
    [wireKey('goldPerProp')]: '5',
    [wireKey('xpPerProp')]: 64,
    [wireKey('itemLevelMin')]: 10,
    [wireKey('itemLevelMax')]: 10,
    [wireKey('chestChancePct')]: 0.14989787080214056,
    [wireKey('keyChancePct')]: 0.14989787080214056,
    [wireKey('goldMult')]: 2,
    [wireKey('xpMult')]: 2,
    [wireKey('cageCeilingPct')]: 5,
    ...overrides,
  };
}

function without(body: Record<string, unknown>, ...symbols: readonly PhaseEconomyWireSymbol[]): Record<string, unknown> {
  const dropped = new Set(symbols.map(wireKey));
  return Object.fromEntries(Object.entries(body).filter(([key]) => !dropped.has(key)));
}

function gatePhaseBody(): Record<string, unknown> {
  return {
    [wireKey('phase')]: 10,
    [wireKey('goldPerProp')]: '254',
    [wireKey('xpPerProp')]: 160,
    [wireKey('itemLevelMin')]: 10,
    [wireKey('itemLevelMax')]: 10,
    [wireKey('chestChancePct')]: 0.14989787080214056,
    [wireKey('gemChancePct')]: 0.007494893540107028,
    [wireKey('timeChancePct')]: 0.14989787080214056,
    [wireKey('stoneChancePct')]: 0.07494893540107028,
    [wireKey('goldMult')]: 2,
    [wireKey('xpMult')]: 2,
    [wireKey('cageCeilingPct')]: 5,
  };
}

describe('identifyObservedBody: the per-phase economy', () => {
  it('names an ordinary phase body and a gate phase body', () => {
    expect(identifyObservedBody(ordinaryPhaseBody())).toEqual({ kind: 'phaseEconomy' });
    expect(identifyObservedBody(gatePhaseBody())).toEqual({ kind: 'phaseEconomy' });
  });

  it('still names a body sent without either multiplier', () => {
    expect(identifyObservedBody(without(ordinaryPhaseBody(), 'goldMult', 'xpMult'))).toEqual({ kind: 'phaseEconomy' });
  });

  it('still names a body the game added a key to', () => {
    expect(identifyObservedBody(ordinaryPhaseBody({ added_in_a_patch: 1 }))).toEqual({ kind: 'phaseEconomy' });
  });

  it('does not take a numeric per-prop gold for this body', () => {
    expect(isPhaseEconomyBody(ordinaryPhaseBody({ [wireKey('goldPerProp')]: 5 }))).toBe(false);
  });

  it('is never reported as drift of an account section', () => {
    expect(diagnoseObservedBodyDrift(ordinaryPhaseBody())).toEqual([]);
  });
});

describe('readPhaseEconomy', () => {
  it('reads an ordinary phase, gold as a number and the gate-only chances absent', () => {
    expect(readPhaseEconomy(ordinaryPhaseBody())).toEqual({
      economy: {
        phase: 1,
        goldPerProp: 5,
        xpPerProp: 64,
        goldMult: 2,
        xpMult: 2,
        itemLevelMin: 10,
        itemLevelMax: 10,
        chestChancePct: 0.14989787080214056,
        keyChancePct: 0.14989787080214056,
        gemChancePct: null,
        stoneChancePct: null,
        timeChancePct: null,
        cageCeilingPct: 5,
      },
      ignored: 0,
    });
  });

  it('reads a gate phase with no key chance', () => {
    const read = readPhaseEconomy(gatePhaseBody());

    expect(read?.economy).toMatchObject({ phase: 10, goldPerProp: 254, xpPerProp: 160, keyChancePct: null, gemChancePct: 0.007494893540107028 });
  });

  it('reads an absent multiplier as null, not as 1', () => {
    expect(readPhaseEconomy(without(ordinaryPhaseBody(), 'xpMult'))?.economy.xpMult).toBeNull();
  });

  it('accepts the second chest chance and counts an undeclared key without refusing the body', () => {
    const read = readPhaseEconomy(ordinaryPhaseBody({ [wireKey('chestRollChancePct')]: 0.1727, added_in_a_patch: true }));

    expect(read?.economy.phase).toBe(1);
    expect(read?.ignored).toBe(1);
  });

  it.each([
    ['phase missing', without(ordinaryPhaseBody(), 'phase')],
    ['phase not a whole number', ordinaryPhaseBody({ [wireKey('phase')]: 1.5 })],
    ['gold per prop not a digit string', ordinaryPhaseBody({ [wireKey('goldPerProp')]: '5.5' })],
    ['xp per prop a string', ordinaryPhaseBody({ [wireKey('xpPerProp')]: '64' })],
    ['cage ceiling missing', without(ordinaryPhaseBody(), 'cageCeilingPct')],
    ['an optional chance malformed', ordinaryPhaseBody({ [wireKey('keyChancePct')]: 'high' })],
  ])('refuses a body with %s', (_label, body) => {
    expect(readPhaseEconomy(body)).toBeNull();
  });
});
