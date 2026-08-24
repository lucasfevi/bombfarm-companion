/**
 * The two concurrency ceilings, in the order the model applies them.
 *
 * 1. HOUSE RECOVERY (`squad.houseSlots`, from `casa.slots`) — the binding one on a real roster.
 *    Each hero occupies a recovery slot for `1 − uptime` of wall clock; when `Σ (1 − uptime)`
 *    exceeds `houseSlots`, the scarce slot-seconds are allocated GREEDILY by value density and
 *    the losers idle. Applied per-row, because the ranking depends on the phase's mitigation.
 * 2. FIELD SLOTS (`squad.fieldSlots`, from `skills.field_slots`) — applied AFTER, to the heroes
 *    the House can actually keep fed (`row.heroesOnField`), never to the raw `uptimeSum`.
 *
 * `row.concurrencyScale` must not change per-hero *shares* (a hero's gold-ability effect is
 * independent of `fieldSlots` — the scale multiplies the whole squad rate uniformly). The House
 * allocation, unlike the field cap, DOES change shares: that is the point of it.
 */
import { describe, expect, it } from 'vitest';
import {
  computeSquadFarmFacts,
  computeFarmRateRow,
  computeHeroFarmFacts,
  type HeroFarmFacts,
} from '@bombfarm/domain/farm-rate';
import { loadFarmRateFixture, withAbilityLevels } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();

function syntheticHero(overrides: Partial<HeroFarmFacts> & { heroId: string }): HeroFarmFacts {
  return {
    heroName: overrides.heroId,
    avgHitBase: 100,
    penetrationPct: 0,
    fuseSecs: 2,
    walkSpeedCells: 2,
    cycleSecs: 2,
    plantsPerSec: 0.5,
    blocksPerBomb: 1.5,
    uptime: 1,
    heroLuckPct: 0,
    veiaOuroLevel: 0,
    fortunaLevel: 0,
    degenerate: false,
    ...overrides,
  };
}

/**
 * An account whose House recovers everything in parallel — `houseSlots` above any demand the
 * cases below can generate (7 heroes can demand at most 7 slots). Isolates the FIELD cap.
 */
const UNCONSTRAINED_HOUSE = { ...account, slots: 1000 };

describe('field-slot cap (row.concurrencyScale)', () => {
  it('heroesOnField > fieldSlots ⇒ every rate scales by exactly fieldSlots / heroesOnField', () => {
    // uptime 1 ⇒ House demand 0 ⇒ the House ceiling is inert and heroesOnField === Σ uptime === 4.
    const heroesFacts: HeroFarmFacts[] = [
      syntheticHero({ heroId: 'a' }),
      syntheticHero({ heroId: 'b' }),
      syntheticHero({ heroId: 'c' }),
      syntheticHero({ heroId: 'd' }),
    ];
    const crowded = { ...UNCONSTRAINED_HOUSE, fieldSlots: 3 };
    const squad = computeSquadFarmFacts(heroesFacts, crowded);
    expect(squad.uptimeSum).toBe(4);
    expect(squad.houseSlotDemand).toBe(0);

    const scaledRow = computeFarmRateRow(42, squad)!;
    expect(scaledRow.heroesOnField).toBe(4);
    expect(scaledRow.concurrencyScale).toBeCloseTo(3 / 4, 12);

    // A scale-1 reference squad (same heroes, uncrowded field) isolates the scale factor.
    const uncrowded = { ...UNCONSTRAINED_HOUSE, fieldSlots: 1000 };
    const referenceSquad = computeSquadFarmFacts(heroesFacts, uncrowded);
    const referenceRow = computeFarmRateRow(42, referenceSquad)!;
    expect(referenceRow.concurrencyScale).toBe(1);

    expect(scaledRow.propsPerHour / referenceRow.propsPerHour).toBeCloseTo(3 / 4, 9);
    expect(scaledRow.goldPerHour / referenceRow.goldPerHour).toBeCloseTo(3 / 4, 9);
    expect(scaledRow.xpPerHour / referenceRow.xpPerHour).toBeCloseTo(3 / 4, 9);
  });

  it('heroesOnField < fieldSlots ⇒ scale 1, rates unchanged from the uncrowded reference', () => {
    const heroesFacts: HeroFarmFacts[] = [syntheticHero({ heroId: 'a' })];
    const roomy = { ...UNCONSTRAINED_HOUSE, fieldSlots: 9 };
    const squad = computeSquadFarmFacts(heroesFacts, roomy);
    expect(squad.uptimeSum).toBe(1);
    expect(computeFarmRateRow(42, squad)!.concurrencyScale).toBe(1);
  });

  it('the heroesOnField === fieldSlots boundary ⇒ scale exactly 1 (no scaling)', () => {
    const heroesFacts: HeroFarmFacts[] = [
      syntheticHero({ heroId: 'a' }),
      syntheticHero({ heroId: 'b' }),
      syntheticHero({ heroId: 'c' }),
    ];
    const exact = { ...UNCONSTRAINED_HOUSE, fieldSlots: 3 };
    const squad = computeSquadFarmFacts(heroesFacts, exact);
    const row = computeFarmRateRow(42, squad)!;
    expect(row.heroesOnField).toBe(3);
    expect(row.concurrencyScale).toBe(1);
  });

  it("the field cap cancels out of share — a hero's veia_ouro effect on gold is independent of fieldSlots", () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const boostedJon = withAbilityLevels(jon, { veia_ouro: 10 });
    const heroesBoosted = heroes.map((h) => (h.id === jon.id ? boostedJon : h));

    const facts = computeHeroFarmFacts({ heroes: heroesBoosted, account });

    // The House is held wide open so ONLY the field cap moves between the two squads — otherwise
    // the House allocation would reshuffle shares and this comparison would prove nothing.
    // The fixture's real Σ uptime is ≈0.9 across 5 heroes, so `fieldSlots: 0.5` genuinely
    // oversubscribes it (unlike `1`, which is still above it and leaves the scale at 1).
    const crowded = { ...UNCONSTRAINED_HOUSE, fieldSlots: 0.5 };
    const roomy = { ...UNCONSTRAINED_HOUSE, fieldSlots: 1000 };

    const crowdedRow = computeFarmRateRow(42, computeSquadFarmFacts(facts, crowded))!;
    const roomyRow = computeFarmRateRow(42, computeSquadFarmFacts(facts, roomy))!;
    expect(crowdedRow.concurrencyScale).toBeLessThan(1);
    expect(roomyRow.concurrencyScale).toBe(1);

    // goldPerHour is NOT identical (propsPerHour scales with concurrency) — but the RATIO of
    // goldPerHour to propsPerHour (i.e. the per-prop gold rate, which is what veia_ouro's share
    // acts on) is identical whether the field is crowded or roomy, proving concurrencyScale
    // cancels out of the per-hero share computation.
    const crowdedGoldPerProp = crowdedRow.goldPerHour / crowdedRow.propsPerHour;
    const roomyGoldPerProp = roomyRow.goldPerHour / roomyRow.propsPerHour;
    expect(crowdedGoldPerProp).toBeCloseTo(roomyGoldPerProp, 9);
  });
});

describe('House recovery-slot ceiling', () => {
  /** Field slots wide open, so only the House constraint can move a number. */
  const house = (slots: number) => ({ ...account, slots, fieldSlots: 1000 });

  it('an OVERCOMMITTED roster is throttled: heroesOnField < Σ uptime, and the slot budget is spent exactly', () => {
    // Four heroes at uptime 0.5 ⇒ demand 0.5 each ⇒ 2.0 slots wanted against 1.
    const facts = [0.5, 0.5, 0.5, 0.5].map((uptime, i) =>
      syntheticHero({ heroId: `h${i}`, uptime, plantsPerSec: 0.5 + i / 100 }),
    );
    const squad = computeSquadFarmFacts(facts, house(1));
    expect(squad.uptimeSum).toBeCloseTo(2, 12);
    expect(squad.houseSlotDemand).toBeCloseTo(2, 12);
    expect(squad.houseSlots).toBe(1);

    const row = computeFarmRateRow(42, squad)!;
    // Budget 1 / demand 0.5 each ⇒ exactly two heroes served, at uptime 0.5 apiece.
    expect(row.heroesOnField).toBeCloseTo(1, 12);
    expect(row.heroesOnField).toBeLessThan(squad.uptimeSum);
    expect(row.concurrencyScale).toBe(1); // the field cap is NOT what bit here
  });

  it('the throttle is GREEDY, not uniform: the strongest hero keeps its full duty cycle', () => {
    // Same uptime, wildly different plant rates ⇒ same slot cost, very different value.
    const strong = syntheticHero({ heroId: 'strong', uptime: 0.5, plantsPerSec: 5 });
    const weak = syntheticHero({ heroId: 'weak', uptime: 0.5, plantsPerSec: 0.01 });
    const squad = computeSquadFarmFacts([weak, strong], house(0.5));
    expect(squad.houseSlotDemand).toBeCloseTo(1, 12);

    const row = computeFarmRateRow(42, squad)!;
    // A 0.5-slot budget buys exactly one hero's 0.5 demand. Uniform throttling would give both
    // heroes half their duty (0.25 + 0.25); greedy gives it all to `strong` (0.5 + 0).
    expect(row.heroesOnField).toBeCloseTo(0.5, 12);

    const strongOnly = computeSquadFarmFacts([strong], house(0.5));
    const strongOnlyRow = computeFarmRateRow(42, strongOnly)!;
    // Throughput equals the strong hero running alone: `weak` got nothing.
    expect(row.propsPerHour).toBeCloseTo(strongOnlyRow.propsPerHour, 9);
    // Order-independence: the same result whichever way the pool is listed.
    const reversed = computeFarmRateRow(42, computeSquadFarmFacts([strong, weak], house(0.5)))!;
    expect(reversed.propsPerHour).toBe(row.propsPerHour);
  });

  it('an UNDER-committed roster leaves the constraint INERT — identical to an unlimited House', () => {
    const facts = [0.5, 0.25].map((uptime, i) => syntheticHero({ heroId: `h${i}`, uptime }));
    const squad = computeSquadFarmFacts(facts, house(9));
    expect(squad.houseSlotDemand).toBeCloseTo(1.25, 12);
    expect(squad.houseSlotDemand).toBeLessThan(squad.houseSlots);

    const row = computeFarmRateRow(42, squad)!;
    expect(row.heroesOnField).toBeCloseTo(squad.uptimeSum, 12);

    const unlimited = computeFarmRateRow(42, computeSquadFarmFacts(facts, house(1e9)))!;
    expect(row.propsPerHour).toBe(unlimited.propsPerHour);
    expect(row.goldPerHour).toBe(unlimited.goldPerHour);
    expect(row.clearSecs).toBe(unlimited.clearSecs);
  });

  it('the demand === houseSlots boundary is inert (served exactly, nothing throttled)', () => {
    const facts = [0.5, 0.5].map((uptime, i) => syntheticHero({ heroId: `h${i}`, uptime }));
    const squad = computeSquadFarmFacts(facts, house(1));
    expect(squad.houseSlotDemand).toBeCloseTo(1, 12);
    expect(computeFarmRateRow(42, squad)!.heroesOnField).toBeCloseTo(squad.uptimeSum, 12);
  });

  it('a SINGLE hero is never throttled below one House slot — it can only ever ask for one', () => {
    const solo = syntheticHero({ heroId: 'solo', uptime: 0.2 });
    const squad = computeSquadFarmFacts([solo], house(1));
    expect(squad.houseSlotDemand).toBeCloseTo(0.8, 12);
    const row = computeFarmRateRow(42, squad)!;
    expect(row.heroesOnField).toBeCloseTo(0.2, 12);

    // Even a fractional House (0.5 slots) throttles it proportionally rather than to zero.
    const halfSquad = computeSquadFarmFacts([solo], house(0.5));
    const halfRow = computeFarmRateRow(42, halfSquad)!;
    expect(halfRow.heroesOnField).toBeCloseTo(0.2 * (0.5 / 0.8), 12);
    expect(halfRow.propsPerHour).toBeCloseTo(row.propsPerHour * (0.5 / 0.8), 9);
  });

  it('an EMPTY pool: zero demand, zero heroes on field, scale 1 — no 0/0', () => {
    const squad = computeSquadFarmFacts([], house(3));
    expect(squad.uptimeSum).toBe(0);
    expect(squad.houseSlotDemand).toBe(0);

    const row = computeFarmRateRow(42, squad)!;
    expect(row.heroesOnField).toBe(0);
    expect(row.concurrencyScale).toBe(1);
    expect(row.propsPerHour).toBe(0);
    expect(Number.isNaN(row.goldPerHour)).toBe(false);
  });

  it('BOTH caps bind at once: heroesOnField/fieldSlots is the applied scale, not uptimeSum/fieldSlots (the double-charging error §554-556 warns against)', () => {
    // Four identical uptime-0.5 heroes: House demand 0.5 each, 2.0 total against a 1-slot House —
    // the allocator (tie-broken to roster order, since value density is identical) can only ever
    // pay for two of them. `fieldSlots: 0.5` then oversubscribes even THAT already-throttled
    // heroesOnField (1.0), so the field cap also bites — both ceilings bind on the same row.
    const facts = [0, 1, 2, 3].map((i) => syntheticHero({ heroId: `h${i}`, uptime: 0.5 }));
    const bothBinding = house(1);
    const squad = computeSquadFarmFacts(facts, { ...bothBinding, fieldSlots: 0.5 });
    expect(squad.uptimeSum).toBeCloseTo(2, 12);
    expect(squad.houseSlotDemand).toBeCloseTo(2, 12);

    const row = computeFarmRateRow(42, squad)!;
    // The House ceiling alone already throttles the roster from 2.0 to 1.0 heroes on field.
    expect(row.heroesOnField).toBeCloseTo(1, 12);
    expect(row.heroesOnField).toBeLessThan(squad.uptimeSum);

    // CORRECT ordering: the field cap divides fieldSlots by the House-allocated heroesOnField
    // (1.0), not by the raw uptimeSum (2.0) — 0.5/1.0 = 0.5, not 0.5/2.0 = 0.25.
    expect(row.concurrencyScale).toBeCloseTo(0.5, 12);
    const doubleChargedScale = squad.fieldSlots / squad.uptimeSum;
    expect(doubleChargedScale).toBeCloseTo(0.25, 12);
    expect(row.concurrencyScale).not.toBeCloseTo(doubleChargedScale, 6);

    // The field-cap-only reference squad (same House constraint, field wide open) isolates the
    // scale factor: propsPerHour must drop by exactly `concurrencyScale` (0.5), not by the
    // double-charging variant's 0.25.
    const referenceRow = computeFarmRateRow(42, computeSquadFarmFacts(facts, { ...bothBinding, fieldSlots: 1000 }))!;
    expect(referenceRow.concurrencyScale).toBe(1);
    expect(row.propsPerHour / referenceRow.propsPerHour).toBeCloseTo(0.5, 9);
  });

  it('a hero with ZERO field seconds (uptime 0) costs a full slot, delivers nothing, and is ranked last', () => {
    // `fieldSeconds` 0 ⇒ uptime 0. It still occupies a recovery slot (demand 1 − 0 = 1), so a
    // naive allocator could hand it the whole budget and starve the hero that actually farms.
    const idle = syntheticHero({ heroId: 'idle', uptime: 0 });
    const worker = syntheticHero({ heroId: 'worker', uptime: 0.5, plantsPerSec: 0.5 });

    const squad = computeSquadFarmFacts([idle, worker], house(0.5));
    expect(squad.uptimeSum).toBe(0.5);
    expect(squad.houseSlotDemand).toBe(1.5);

    const row = computeFarmRateRow(42, squad)!;
    // The whole 0.5-slot budget went to `worker` (demand 0.5), leaving `idle` at zero.
    expect(row.heroesOnField).toBeCloseTo(0.5, 12);
    const workerAlone = computeFarmRateRow(42, computeSquadFarmFacts([worker], house(0.5)))!;
    expect(row.propsPerHour).toBeCloseTo(workerAlone.propsPerHour, 9);
    expect(Number.isFinite(row.goldPerHour)).toBe(true);
  });
});

/**
 * `fieldContentionPct` — the frequency the field is full with a rested hero benched.
 *
 * A DIAGNOSTIC ONLY. `concurrencyScale` is unchanged by its introduction; these cases exist to
 * hold that separation, because the reason the frequency ships and a corrected magnitude does not
 * is that the frequency needs no assumption about WHICH hero takes a freed slot.
 */
describe('field contention (row.fieldContentionPct)', () => {
  const wideHouse = { ...account, slots: 1000 };
  const rowFor = (count: number, uptime: number, fieldSlots: number) => {
    const facts = Array.from({ length: count }, (_, i) => syntheticHero({ heroId: `h${i}`, uptime }));
    return computeFarmRateRow(42, computeSquadFarmFacts(facts, { ...wideHouse, fieldSlots }))!;
  };

  it('is exactly 0 whenever the field cannot fill, however low each hero own uptime is', () => {
    expect(rowFor(10, 0.6, 10).fieldContentionPct).toBe(0);
    expect(rowFor(10, 0.6, 1000).fieldContentionPct).toBe(0);
    expect(rowFor(3, 0.2, 3).fieldContentionPct).toBe(0);
  });

  it('is 100 when every hero is always deployed and they outnumber the slots', () => {
    // uptime 1 ⇒ no fluctuation at all ⇒ the field is over-subscribed every single second.
    expect(rowFor(4, 1, 3).fieldContentionPct).toBeCloseTo(100, 9);
  });

  it('reports a mean UNDER the cap that still fluctuates across it — the case a mean cannot see', () => {
    // Ten heroes at uptime 0.6 ⇒ mean occupancy 6.0 against 8 slots. `concurrencyScale` reads 1
    // (its mean genuinely sits under the cap); the field is nonetheless full with someone waiting
    // a real share of the time, and that is the whole point of reporting the frequency.
    const row = rowFor(10, 0.6, 8);
    expect(row.concurrencyScale).toBe(1);
    expect(row.fieldContentionPct).toBeGreaterThan(1);
    expect(row.fieldContentionPct).toBeLessThan(50);

    // Tightening the cap onto the mean makes it unmistakable rather than marginal.
    // `toBeCloseTo`, not `toBe`: 10 x 0.7 sums to 7.000000000000001 in IEEE754, so the ratio
    // lands a bit under 1 rather than exactly on it. The claim is "the mean does not bind".
    const tighter = rowFor(10, 0.7, 7);
    expect(tighter.concurrencyScale).toBeCloseTo(1, 12);
    expect(tighter.fieldContentionPct).toBeGreaterThan(30);
  });

  it('rises monotonically as slots are removed, and stays a percentage throughout', () => {
    let previous = -1;
    for (const slots of [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
      const { fieldContentionPct } = rowFor(10, 0.6, slots);
      expect(fieldContentionPct).toBeGreaterThanOrEqual(previous);
      expect(fieldContentionPct).toBeGreaterThanOrEqual(0);
      expect(fieldContentionPct).toBeLessThanOrEqual(100);
      previous = fieldContentionPct;
    }
  });

  it('never emits NaN on the degenerate inputs (empty pool, zero uptime, zero slots)', () => {
    const emptyRow = computeFarmRateRow(42, computeSquadFarmFacts([], { ...wideHouse, fieldSlots: 2 }))!;
    expect(emptyRow.fieldContentionPct).toBe(0);
    expect(Number.isFinite(rowFor(5, 0, 2).fieldContentionPct)).toBe(true);
    expect(Number.isFinite(rowFor(5, 0.5, 0).fieldContentionPct)).toBe(true);
  });
});
