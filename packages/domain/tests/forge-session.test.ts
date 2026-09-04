import { describe, expect, it } from 'vitest';
import {
  classifyForgeRoll,
  emptyForgeTally,
  evalForgeStop,
  foldForgeStep,
  type ForgeLimits,
  type ForgeSessionState,
} from '@bombfarm/domain/forge';

describe('classifyForgeRoll', () => {
  it('judges a roll against the level it tried to reach: a fail at +9 from +8 that lands on +8 is a fail', () => {
    expect(classifyForgeRoll({ after: 8, target: 9 })).toBe('fail');
  });

  it('calls a fail at +15 that lands on +0 a fail', () => {
    expect(classifyForgeRoll({ after: 0, target: 15 })).toBe('fail');
  });

  it('calls landing on the target a success', () => {
    expect(classifyForgeRoll({ after: 9, target: 9 })).toBe('success');
  });

  it('calls a safe jump landing on +8 a success, never a critical', () => {
    expect(classifyForgeRoll({ after: 8, target: 8, kind: 'safe' })).toBe('success');
    expect(classifyForgeRoll({ after: 8, target: 8, kind: 'safe', serverCritical: true })).toBe('success');
  });

  it('calls landing above the target a critical', () => {
    expect(classifyForgeRoll({ after: 11, target: 10 })).toBe('critical');
  });

  it('lets the server flag win even when the landing level alone would not say so', () => {
    expect(classifyForgeRoll({ after: 10, target: 10, serverCritical: true })).toBe('critical');
  });
});

describe('evalForgeStop', () => {
  const limits: ForgeLimits = { target: 12, maxAttempts: 10, maxGold: 100_000 };
  const running: ForgeSessionState = {
    upgrade: 9,
    attempt: 3,
    spent: 40_000,
    cancelled: false,
    nextCost: 10_000,
    wallet: 500_000,
  };

  it('keeps going while no limit is reached', () => {
    expect(evalForgeStop(running, limits)).toBeNull();
  });

  it('stops on target first, before anything else', () => {
    expect(
      evalForgeStop({ ...running, upgrade: 12, cancelled: true, attempt: 99, spent: 1e9, wallet: 0 }, limits),
    ).toBe('target');
  });

  it('a cancel wins over the attempt, budget and wallet limits', () => {
    expect(evalForgeStop({ ...running, cancelled: true, attempt: 99, spent: 1e9, wallet: 0 }, limits)).toBe(
      'cancelled',
    );
  });

  it('stops on attempts once the attempts already made reach the cap', () => {
    expect(evalForgeStop({ ...running, attempt: 10 }, limits)).toBe('attempts');
    expect(evalForgeStop({ ...running, attempt: 9 }, limits)).toBeNull();
  });

  it('stops on budget when the next roll would take spending past the cap, not when it lands exactly on it', () => {
    expect(evalForgeStop({ ...running, spent: 90_001 }, limits)).toBe('budget');
    expect(evalForgeStop({ ...running, spent: 90_000 }, limits)).toBeNull();
  });

  it('stops on shortfall when a known wallet cannot pay the next roll, and never when the wallet is unknown', () => {
    expect(evalForgeStop({ ...running, wallet: 9_999 }, limits)).toBe('shortfall');
    expect(evalForgeStop({ ...running, wallet: 10_000 }, limits)).toBeNull();
    expect(evalForgeStop({ ...running, wallet: null }, limits)).toBeNull();
  });

  it('ranks attempts above budget and budget above shortfall', () => {
    expect(evalForgeStop({ ...running, attempt: 10, spent: 99_999, wallet: 0 }, limits)).toBe('attempts');
    expect(evalForgeStop({ ...running, spent: 99_999, wallet: 0 }, limits)).toBe('budget');
  });

  it('treats a null attempt or gold limit as no limit', () => {
    const unlimited: ForgeLimits = { target: 12, maxAttempts: null, maxGold: null };
    expect(evalForgeStop({ ...running, attempt: 1_000, spent: 1e9 }, unlimited)).toBeNull();
  });
});

describe('foldForgeStep', () => {
  it('starts every count at zero', () => {
    expect(emptyForgeTally()).toEqual({ rolls: 0, fails: 0, crits: 0, safeJumps: 0, spent: 0 });
  });

  it('counts safe jumps apart from rolls', () => {
    const tally = foldForgeStep(emptyForgeTally(), { outcome: 'success', kind: 'safe', cost: 14_200 });
    expect(tally).toEqual({ rolls: 0, fails: 0, crits: 0, safeJumps: 1, spent: 14_200 });
  });

  it('counts fails and crits among the rolls and accumulates gold across every step', () => {
    let tally = emptyForgeTally();
    tally = foldForgeStep(tally, { outcome: 'success', kind: 'roll', cost: 100 });
    tally = foldForgeStep(tally, { outcome: 'fail', kind: 'roll', cost: 200 });
    tally = foldForgeStep(tally, { outcome: 'critical', kind: 'roll', cost: 300 });
    tally = foldForgeStep(tally, { outcome: 'success', kind: 'safe', cost: 400 });
    expect(tally).toEqual({ rolls: 3, fails: 1, crits: 1, safeJumps: 1, spent: 1_000 });
    expect(tally.rolls - tally.fails - tally.crits).toBe(1);
  });

  it('leaves the tally it was given untouched', () => {
    const before = emptyForgeTally();
    foldForgeStep(before, { outcome: 'fail', kind: 'roll', cost: 50 });
    expect(before).toEqual(emptyForgeTally());
  });
});
