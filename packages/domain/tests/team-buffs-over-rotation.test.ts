/**
 * `computeTeamBuffsOverRotation` — the aura total a ROTATION sustains, as opposed to the one a
 * fixed deployed line-up shows.
 *
 * A team aura is a property of the field, so it exists only while a carrier is standing in it.
 * `computeTeamBuffsFromDeployed` answers "what is the aura right now", which is what the advisor
 * and the team-plan scorer want. The Farm Ranking board prices a pool cycling through the House
 * for hours, where a carrier at uptime 0.58 supplies its aura for 58% of the run and nothing for
 * the other 42% — a different question, answered here.
 *
 * The case that decides the shape of the answer is the MULTI-CARRIER one, and it is the reason
 * this is not a one-line weighted sum: see `saturating carriers` below.
 */
import { describe, expect, it } from 'vitest';
import { emptyLoadout, emptySheet } from '@bombfarm/domain/gear';
import { ZERO_PTS } from '@bombfarm/domain/planner-constants';
import {
  TEAM_BUFF_CAP,
  TEAM_BUFF_PER_LEVEL,
  computeTeamBuffsFromDeployed,
  computeTeamBuffsOverRotation,
} from '@bombfarm/domain/team-buffs';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';

function hero(id: string, abilities: Record<string, number>, deployed = false): HeroRecord {
  return {
    id,
    name: id,
    rarity: 1,
    level: 1,
    stars: 0,
    pts: { ...ZERO_PTS },
    naked: emptySheet(),
    loadout: emptyLoadout(),
    abilities,
    deployed,
    updatedAt: 0,
  } as unknown as HeroRecord;
}

describe('presence weighting — a carrier supplies its aura only while it is on the field', () => {
  it('one carrier at uptime u is worth u x its deployed value', () => {
    const roster = [hero('grito20', { grito_guerra: 20 })];
    const full = computeTeamBuffsOverRotation(roster, null);
    const half = computeTeamBuffsOverRotation(roster, [0.5]);

    expect(full.grito_guerra).toBeCloseTo(20 * TEAM_BUFF_PER_LEVEL.grito_guerra, 12);
    expect(half.grito_guerra).toBeCloseTo(full.grito_guerra / 2, 12);
  });

  it('`null` presence reproduces the roster at-best total, which is the seeding pass farm-rate uses', () => {
    const roster = [hero('a', { grito_guerra: 8 }), hero('b', { grito_guerra: 5 })];
    const atBest = computeTeamBuffsOverRotation(roster, null);
    expect(atBest.grito_guerra).toBeCloseTo(13 * TEAM_BUFF_PER_LEVEL.grito_guerra, 12);
  });

  it('a hero that never reaches the field contributes nothing, however high its rank', () => {
    const roster = [hero('never', { folego_mineiro: 20 }), hero('always', { folego_mineiro: 3 })];
    const out = computeTeamBuffsOverRotation(roster, [0, 1]);
    expect(out.folego_mineiro).toBeCloseTo(3 * TEAM_BUFF_PER_LEVEL.folego_mineiro, 12);
  });

  it('presence is clamped to [0, 1], and a non-finite weight reads as absent rather than as NaN', () => {
    const roster = [hero('a', { grito_guerra: 10 }), hero('b', { grito_guerra: 10 })];
    const clamped = computeTeamBuffsOverRotation(roster, [5, -2]);
    const broken = computeTeamBuffsOverRotation(roster, [Number.NaN, 1]);

    expect(clamped.grito_guerra).toBeCloseTo(10 * TEAM_BUFF_PER_LEVEL.grito_guerra, 12);
    expect(broken.grito_guerra).toBeCloseTo(10 * TEAM_BUFF_PER_LEVEL.grito_guerra, 12);
    expect(Number.isFinite(broken.grito_guerra)).toBe(true);
  });

  it('is INDEPENDENT of who is deployed — the whole point, against computeTeamBuffsFromDeployed', () => {
    const parked = [hero('carrier', { grito_guerra: 20 }, false)];
    const deployed = [hero('carrier', { grito_guerra: 20 }, true)];

    // The snapshot sees a carrier only when it is standing on the field at export time.
    expect(computeTeamBuffsFromDeployed(parked).grito_guerra).toBe(0);
    expect(computeTeamBuffsFromDeployed(deployed).grito_guerra).toBeGreaterThan(0);

    // The rotation reading does not care: `deployed` is an instant, presence is a duty cycle.
    const parkedOverRotation = computeTeamBuffsOverRotation(parked, [0.5]);
    const deployedOverRotation = computeTeamBuffsOverRotation(deployed, [0.5]);
    expect(parkedOverRotation).toEqual(deployedOverRotation);
    expect(parkedOverRotation.grito_guerra).toBeGreaterThan(0);
  });
});

describe('saturating carriers — the cap is taken INSIDE the expectation, not after it', () => {
  const CAP = TEAM_BUFF_CAP.folego_mineiro;

  it('two half-present rank-20 carriers do NOT read as one permanently present carrier', () => {
    const roster = [hero('a', { folego_mineiro: 20 }), hero('b', { folego_mineiro: 20 })];
    const out = computeTeamBuffsOverRotation(roster, [0.578, 0.55]);

    // `min(cap, sum of weighted contributions)` would clamp 22.56 to the full 20 and assert that
    // at least one carrier is up 100% of the time. Independent carriers at these uptimes cover
    // 1 - 0.422 x 0.45 = 81.0% of wall clock.
    const coverage = 1 - (1 - 0.578) * (1 - 0.55);
    expect(out.folego_mineiro).toBeCloseTo(CAP * coverage, 9);
    expect(out.folego_mineiro).toBeLessThan(CAP);
    expect(out.folego_mineiro).toBeCloseTo(16.2, 1);
  });

  it('never exceeds the cap, even at full presence across many carriers', () => {
    const roster = [0, 1, 2, 3].map((i) => hero(`c${i}`, { folego_mineiro: 20 }));
    const out = computeTeamBuffsOverRotation(roster, [1, 1, 1, 1]);
    expect(out.folego_mineiro).toBeCloseTo(CAP, 9);
  });

  it('stays exactly linear while the cap is out of reach — no coverage discount is applied early', () => {
    // Two rank-4 carriers sum to 8, well under the cap, so each is worth its own weighted value
    // and the answer must be the plain weighted sum.
    const roster = [hero('a', { folego_mineiro: 4 }), hero('b', { folego_mineiro: 4 })];
    const out = computeTeamBuffsOverRotation(roster, [0.5, 0.25]);
    expect(out.folego_mineiro).toBeCloseTo((4 * 0.5 + 4 * 0.25) * TEAM_BUFF_PER_LEVEL.folego_mineiro, 12);
  });

  it('is monotone in presence — more field time never prices an aura lower', () => {
    const roster = [hero('a', { folego_mineiro: 20 }), hero('b', { folego_mineiro: 20 })];
    let previous = -1;
    for (const u of [0, 0.2, 0.4, 0.6, 0.8, 1]) {
      const value = computeTeamBuffsOverRotation(roster, [u, u]).folego_mineiro;
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    expect(previous).toBeCloseTo(CAP, 9);
  });

  it('sits at or below the cap-after-sum reading, which is the staggered-rotation upper bound', () => {
    const roster = [hero('a', { folego_mineiro: 20 }), hero('b', { folego_mineiro: 12 })];
    const presence = [0.7, 0.6];
    const out = computeTeamBuffsOverRotation(roster, presence).folego_mineiro;

    const capAfterSum = Math.min(
      CAP,
      (20 * presence[0] + 12 * presence[1]) * TEAM_BUFF_PER_LEVEL.folego_mineiro,
    );
    expect(out).toBeLessThanOrEqual(capAfterSum + 1e-9);
    expect(out).toBeGreaterThan(0);
  });
});

describe('every aura id is priced, and an empty roster is a total function', () => {
  it('returns a zeroed record for an empty roster rather than an empty object', () => {
    const out = computeTeamBuffsOverRotation([], null);
    for (const id of Object.keys(TEAM_BUFF_CAP)) {
      expect(out[id as keyof typeof TEAM_BUFF_CAP]).toBe(0);
    }
  });

  it('prices all four auras from one roster, each against its own cap', () => {
    const roster = [
      hero('a', { grito_guerra: 20, folego_mineiro: 20, marcha_acelerada: 20, pressagio_mortal: 20 }),
      hero('b', { grito_guerra: 20, folego_mineiro: 20, marcha_acelerada: 20, pressagio_mortal: 20 }),
    ];
    const out = computeTeamBuffsOverRotation(roster, [1, 1]);
    for (const [id, cap] of Object.entries(TEAM_BUFF_CAP)) {
      expect(out[id as keyof typeof TEAM_BUFF_CAP]).toBeCloseTo(cap, 9);
    }
  });
});
