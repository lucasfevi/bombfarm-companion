import { describe, expect, it } from 'vitest';
import { emptyLoadout, emptySheet } from '@bombfarm/domain/gear';
import { combineDrainRate } from '@bombfarm/domain/drain';
import { resolveFieldDrainMultipliers } from '@bombfarm/domain/live';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

function hero(id: string, abilities: Record<string, number>): HeroRecord {
  return {
    id,
    name: id,
    updatedAt: 0,
    rarity: 'Comum',
    level: 1,
    stars: 0,
    naked: emptySheet(),
    loadout: emptyLoadout(),
    altLoadout: null,
    gearedOverride: emptySheet(),
    abilities,
    pts: ZERO_PTS(),
    deployed: false,
  };
}

describe('resolveFieldDrainMultipliers', () => {
  it('a hero carrying Bateria Extra resolves a modelled rate below the unreduced base — the fold is actually reached', () => {
    const reduced = hero('reduced', { bateria_extra: 13 });

    const multipliers = resolveFieldDrainMultipliers([reduced]);

    const resolved = multipliers.get('reduced');
    expect(resolved).toBeDefined();
    expect(resolved!.selfDrainMult).toBeCloseTo(0.87, 6);
    expect(combineDrainRate(resolved!.selfDrainMult, resolved!.teamDrainMult)).toBeLessThan(1);
  });

  it('a hero with no drain-reduction abilities resolves the unreduced base, not a guess', () => {
    const plain = hero('plain', {});

    const multipliers = resolveFieldDrainMultipliers([plain]);

    expect(combineDrainRate(multipliers.get('plain')!.selfDrainMult, multipliers.get('plain')!.teamDrainMult)).toBe(1);
  });

  it("the team drain multiplier is shared by every hero on the field, from the field's own Fôlego de Mineiro total", () => {
    const carrier = hero('carrier', { folego_mineiro: 20 });
    const rider = hero('rider', {});

    const multipliers = resolveFieldDrainMultipliers([carrier, rider]);

    expect(multipliers.get('carrier')!.teamDrainMult).toBeCloseTo(0.8, 6);
    expect(multipliers.get('rider')!.teamDrainMult).toBeCloseTo(0.8, 6);
  });

  it('an aura carrier leaving the field changes the remaining heroes’ resolved team drain multiplier', () => {
    const carrier = hero('carrier', { folego_mineiro: 20 });
    const rider = hero('rider', {});

    const withCarrier = resolveFieldDrainMultipliers([carrier, rider]);
    const withoutCarrier = resolveFieldDrainMultipliers([rider]);

    expect(withoutCarrier.get('rider')!.teamDrainMult).toBeGreaterThan(withCarrier.get('rider')!.teamDrainMult);
    expect(withoutCarrier.get('rider')!.teamDrainMult).toBe(1);
  });

  it('a stale roster deployed flag never suppresses a hero actually standing on the field', () => {
    const carrier = hero('carrier', { folego_mineiro: 20 }); // deployed: false, per the helper above

    const multipliers = resolveFieldDrainMultipliers([carrier]);

    // If the resolver trusted the roster's own `deployed` bit instead of the live on-field set
    // it was called with, this carrier's own aura would not even reach itself.
    expect(multipliers.get('carrier')!.teamDrainMult).toBeCloseTo(0.8, 6);
  });
});
