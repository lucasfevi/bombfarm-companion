import { describe, expect, it } from 'vitest';
import { FORJA_MAX } from '@bombfarm/domain/gear';
import type { Loadout } from '@bombfarm/domain/gear';
import { withExpectedForge } from '@/features/team-plan/model/proposed-gear-forecast';

function item(upgrade: number) {
  return { defId: 'ember_arma', rarityIdx: 2, level: 30, upgrade };
}

describe('withExpectedForge', () => {
  it('raises each item below the floor up to the floor', () => {
    const loadout: Loadout = { arma: item(3), elmo: item(8) };
    const out = withExpectedForge(loadout, 10);
    expect(out.arma?.upgrade).toBe(10);
    expect(out.elmo?.upgrade).toBe(10);
  });

  it('leaves items already at or above the floor untouched', () => {
    const loadout: Loadout = { arma: item(12) };
    const out = withExpectedForge(loadout, 10);
    expect(out.arma?.upgrade).toBe(12);
  });

  it('is a no-op when the plan applied no forge floor', () => {
    const loadout: Loadout = { arma: item(3) };
    const out = withExpectedForge(loadout, 0);
    expect(out.arma?.upgrade).toBe(3);
  });

  it('clamps the floor itself to FORJA_MAX', () => {
    const loadout: Loadout = { arma: item(0) };
    const out = withExpectedForge(loadout, FORJA_MAX + 5);
    expect(out.arma?.upgrade).toBe(FORJA_MAX);
  });

  it('passes through empty slots and preserves every other field', () => {
    const loadout: Loadout = { arma: item(3), elmo: null };
    const out = withExpectedForge(loadout, 10);
    expect(out.elmo).toBeNull();
    expect(out.arma).toEqual({ defId: 'ember_arma', rarityIdx: 2, level: 30, upgrade: 10 });
  });
});
