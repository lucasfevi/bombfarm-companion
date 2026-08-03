import { describe, expect, it } from 'vitest';
import { computeTeamBuffsFromDeployed } from '@bombfarm/domain/team-buffs';
import { normalizeHero } from '@/shared/lib/storage';

describe('computeTeamBuffsFromDeployed', () => {
  it('sums perLevel x level across deployed heroes, excluding the active one', () => {
    const active = normalizeHero({ id: 'active', name: 'Active', abilities: { grito_guerra: 10 }, deployed: true });
    const deployedA = normalizeHero({ id: 'a', name: 'A', abilities: { grito_guerra: 5, marcha_acelerada: 10 }, deployed: true });
    const deployedB = normalizeHero({ id: 'b', name: 'B', abilities: { grito_guerra: 3 }, deployed: true });
    const benched = normalizeHero({ id: 'c', name: 'Benched', abilities: { grito_guerra: 10 }, deployed: false });

    const result = computeTeamBuffsFromDeployed([active, deployedA, deployedB, benched], 'active');

    // grito_guerra perLevel = 1 (W3: 2 -> 1) -> (5+3)*1 = 8; active's own 10 levels excluded, benched excluded.
    expect(result.grito_guerra).toBe(8);
    // marcha_acelerada perLevel = 0.185 (W3: 0.4 -> 0.185, NOT naive-halved 0.2) -> 10*0.185 = 1.85
    expect(result.marcha_acelerada).toBeCloseTo(1.85, 6);
    expect(result.pressagio_mortal).toBe(0);
    expect(result.folego_mineiro).toBe(0);
    expect(result.contra_relogio).toBe(0);
  });

  it('returns all zeros when nobody else is deployed', () => {
    const active = normalizeHero({ id: 'active', name: 'Active', deployed: true });
    const result = computeTeamBuffsFromDeployed([active], 'active');
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });
});
