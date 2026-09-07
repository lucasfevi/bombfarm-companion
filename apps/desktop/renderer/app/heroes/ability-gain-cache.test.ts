import { describe, expect, it } from 'vitest';
import type { AccountShared, HeroRecord } from '@bombfarm/domain/shims/storage';
import { cachedAbilityGains, createAbilityGainCache, type AbilityGainCompute } from './ability-gain-cache';

const ALPHA = { id: 'alpha' } as HeroRecord;
const BETA = { id: 'beta' } as HeroRecord;
const ACCOUNT = {} as AccountShared;

function counting(): { compute: AbilityGainCompute; calls: string[] } {
  const calls: string[] = [];
  const compute: AbilityGainCompute = (hero, _account, phase) => {
    calls.push(`${hero.id} ${String(phase)}`);
    return [{ abilityId: hero.id, level: phase, max: 10, state: { kind: 'maxed' } }];
  };
  return { compute, calls };
}

describe('cachedAbilityGains', () => {
  it('computes once for a hero and a phase, however many times the screen re-renders', () => {
    const cache = createAbilityGainCache();
    const { compute, calls } = counting();

    const first = cachedAbilityGains(cache, compute, ALPHA, ACCOUNT, 51, 30);
    const second = cachedAbilityGains(cache, compute, ALPHA, ACCOUNT, 51, 30);

    expect(calls).toEqual(['alpha 51']);
    expect(second).toBe(first);
  });

  it('keys on the phase, so looking back at a phase already opened costs nothing', () => {
    const cache = createAbilityGainCache();
    const { compute, calls } = counting();

    cachedAbilityGains(cache, compute, ALPHA, ACCOUNT, 51, 30);
    cachedAbilityGains(cache, compute, ALPHA, ACCOUNT, 60, 33);
    cachedAbilityGains(cache, compute, ALPHA, ACCOUNT, 51, 30);

    expect(calls).toEqual(['alpha 51', 'alpha 60']);
  });

  it('keys on the hero, so switching back to a hero already opened costs nothing', () => {
    const cache = createAbilityGainCache();
    const { compute, calls } = counting();

    cachedAbilityGains(cache, compute, ALPHA, ACCOUNT, 51, 30);
    cachedAbilityGains(cache, compute, BETA, ACCOUNT, 51, 30);
    cachedAbilityGains(cache, compute, ALPHA, ACCOUNT, 51, 30);

    expect(calls).toEqual(['alpha 51', 'beta 51']);
  });

  it('throws every entry away when the account block is rebuilt, so no reading outlives its numbers', () => {
    const cache = createAbilityGainCache();
    const { compute, calls } = counting();

    cachedAbilityGains(cache, compute, ALPHA, ACCOUNT, 51, 30);
    cachedAbilityGains(cache, compute, ALPHA, {} as AccountShared, 51, 30);

    expect(calls).toEqual(['alpha 51', 'alpha 51']);
    expect(cache.entries.size).toBe(1);
  });
});
