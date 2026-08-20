import { describe, expect, it } from 'vitest';
import { computeTeamBuffsFromDeployed } from '@bombfarm/domain/team-buffs';
import { normalizeHero } from '@/shared/lib/storage';

// Full acceptance coverage (one carrier alone, carrier + non-carrier, two rank-10 vs one
// rank-20, two rank-20 not doubling, the "which hero is active" regression, the editor
// substitution path) lives in packages/domain/tests/team-buffs.test.ts — this file only proves
// the web-layer HeroRecord shape (normalizeHero) wires into the same function correctly.
describe('computeTeamBuffsFromDeployed (web integration)', () => {
  it('sums perLevel x level across every deployed hero, excluding nobody', () => {
    const a = normalizeHero({ id: 'a', name: 'A', abilities: { grito_guerra: 10 }, deployed: true });
    const b = normalizeHero({ id: 'b', name: 'B', abilities: { grito_guerra: 5, marcha_acelerada: 10 }, deployed: true });
    const c = normalizeHero({ id: 'c', name: 'C', abilities: { grito_guerra: 3 }, deployed: true });
    const benched = normalizeHero({ id: 'bench', name: 'Benched', abilities: { grito_guerra: 10 }, deployed: false });

    const result = computeTeamBuffsFromDeployed([a, b, c, benched]);

    // grito_guerra perLevel = 1 -> (10+5+3)*1 = 18; benched excluded, nobody else is.
    expect(result.grito_guerra).toBe(18);
    // marcha_acelerada perLevel = 0.185 -> 10*0.185 = 1.85
    expect(result.marcha_acelerada).toBeCloseTo(1.85, 6);
    expect(result.pressagio_mortal).toBe(0);
    expect(result.folego_mineiro).toBe(0);
    // contra_relogio is a self ability, not a team aura (Fault 1) — no longer a key at all.
    expect('contra_relogio' in result).toBe(false);
  });

  it('stores the raw, uncapped sum (five rank-20 Fôlego carriers sum to 100, not clamped to 20)', () => {
    const heroes = Array.from({ length: 5 }, (_, i) =>
      normalizeHero({ id: `h${i}`, name: `H${i}`, abilities: { folego_mineiro: 20 }, deployed: true }),
    );
    const result = computeTeamBuffsFromDeployed(heroes);
    expect(result.folego_mineiro).toBe(100);
  });

  it('returns all zeros when nobody is deployed', () => {
    const active = normalizeHero({ id: 'active', name: 'Active', deployed: false });
    const result = computeTeamBuffsFromDeployed([active]);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });
});
