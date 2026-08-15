/**
 * The account-486 throughput anchor.
 *
 * One real save (`farm-rate/save-20260815-486-7heroes.json`, 7 heroes, `phase: 26`) pinned
 * against the live bot telemetry it was captured beside. Its job is to keep the three defects the
 * House-ceiling fix closed from silently re-opening:
 *
 *  A. House recovery slots were not modelled at all — every hero was assumed to recover in
 *     parallel, so `Σ uptime` was taken as the on-field count.
 *  C. Rest seconds came from the `HOUSES` table's whole-minute interpolation (1077s at Casa I
 *     level 11) rather than the save's own `casa.cycle_secs` (1168.42s) — the table runs ~7.8%
 *     fast, and every duty cycle inherited that.
 *  D. `casa.slots` (House RECOVERY concurrency, 3) was read as the FIELD concurrency cap, which
 *     is `skills.field_slots` (6).
 *
 * EVERY ASSERTION HERE IS ON AN INTERMEDIATE TERM, not just on `goldPerHour`. That is deliberate
 * and it is the lesson this file exists to encode: before the fix, a 1.74x concurrency error and
 * a cadence error partly cancelled into a top-line gold figure that looked plausible. A
 * `goldPerHour`-only anchor would have passed straight through it. So the chain is pinned
 * link by link — rest seconds, per-hero uptime, `uptimeSum`, House slot demand, heroes on field,
 * the field scale, clear time — and `goldPerHour` is asserted LAST, as a consequence.
 *
 * THE REMAINING GAP IS DELIBERATE. The estimator still predicts ~499k gold/hr against 371,263
 * observed — a residual ~1.34x. That is the bomb-cadence term (`E_D_CELLS` / the `blocksPerBomb`
 * cycle model), which is held for a pending live fuse-bound capture and is explicitly OUT of this
 * fix's scope. `blocksPerBomb = 1.5` is independently confirmed correct at this phase's prop
 * density (1.53 hits/explosion measured live at 15-51 props), so bending either constant to close
 * the gap would be a compensating error, not a fix. The band assertion below pins the gap OPEN so
 * that a future change closing it has to do so on purpose.
 */
import { describe, expect, it } from 'vitest';
import { computeFarmRates } from '@bombfarm/domain/farm-rate';
import { houseRestSeconds } from '@bombfarm/domain/model';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const FIXTURE = 'save-20260815-486-7heroes.json';
const PHASE = 26;

/** Gold/hr the bot actually banked at phase 26 beside this capture. */
const OBSERVED_GOLD_PER_HOUR = 371_263;
/** Gold per prop the bot actually banked — the term the estimator already gets right. */
const OBSERVED_GOLD_PER_PROP = 216.6;
/** Heroes simultaneously on field, measured from the same telemetry window. */
const OBSERVED_HEROES_ON_FIELD = 1.317;

const { heroes, account, maxPhase } = loadFarmRateFixture(FIXTURE, 'farm-rate');
const { heroFacts, squad, rows } = computeFarmRates({ heroes, account, maxPhase });
const row = rows[PHASE - 1];

describe('the save is read as three distinct quantities (defects C and D)', () => {
  it('all 7 heroes are in the pool, and the row under test is phase 26', () => {
    expect(heroFacts).toHaveLength(7);
    expect(row.phase).toBe(PHASE);
    expect(account.context.phase).toBe(PHASE);
    expect(maxPhase).toBe(52);
  });

  it('houseCycleSecs is the save\'s own casa.cycle_secs (1168.42), NOT the HOUSES table (1077)', () => {
    expect(account.houseCycleSecs).toBeCloseTo(1168.42105263158, 9);
    // The value the pre-fix model used, still reachable and still ~7.8% short — asserted so the
    // size of defect C is visible in the file rather than only in a commit message.
    expect(houseRestSeconds(0, 11)).toBe(1077);
    expect(account.houseCycleSecs! / houseRestSeconds(0, 11)).toBeCloseTo(1.0849, 4);
  });

  it('the House recovery cap (3) and the field cap (6) are read from different keys and are different numbers', () => {
    expect(squad.houseSlots).toBe(3); // casa.slots
    expect(squad.fieldSlots).toBe(6); // skills.field_slots
    expect(squad.fieldSlots).not.toBe(squad.houseSlots);
  });
});

describe('the House is the binding constraint (defect A)', () => {
  it('Σ uptime is 1.6927 — every hero well under its own duty ceiling, so uptimeSum alone looks harmless', () => {
    expect(squad.uptimeSum).toBeCloseTo(1.6927, 4);
    // The pre-fix figure, at the pre-fix rest seconds, for the record: 1.7905.
    expect(squad.uptimeSum).toBeLessThan(squad.houseSlots);
  });

  it('yet the roster demands 5.31 recovery slots against the 3 it owns — a 1.77x overcommit', () => {
    expect(squad.houseSlotDemand).toBeCloseTo(5.3073, 4);
    expect(squad.houseSlotDemand / squad.houseSlots).toBeCloseTo(1.769, 3);
    expect(squad.houseSlotDemand).toBeGreaterThan(squad.houseSlots);
    // The identity the demand is derived from: Σ uptime + Σ (1 − uptime) === roster size.
    expect(squad.uptimeSum + squad.houseSlotDemand).toBeCloseTo(7, 9);
  });

  it('the greedy allocation lands heroesOnField at 1.3153 — within 0.2% of the live-measured 1.317', () => {
    expect(row.heroesOnField).toBeCloseTo(1.3153, 4);
    expect(Math.abs(row.heroesOnField / OBSERVED_HEROES_ON_FIELD - 1)).toBeLessThan(0.01);
    // Strictly below the unconstrained sum: the constraint really bit.
    expect(row.heroesOnField).toBeLessThan(squad.uptimeSum);

    // Uniform throttling — the wrong model — would put ~1.03 heroes on field here, a 22% miss
    // against telemetry that greedy does not have. Pinned as a discriminator: an implementation
    // that scaled every hero by `houseSlots / houseSlotDemand` instead would fail this.
    const uniform = squad.uptimeSum * (squad.houseSlots / squad.houseSlotDemand);
    expect(uniform).toBeCloseTo(1.0, 1);
    expect(row.heroesOnField).toBeGreaterThan(uniform * 1.2);
  });

  it('the field cap is NOT what binds here — 6 slots against 1.32 heroes on field', () => {
    expect(row.concurrencyScale).toBe(1);
    expect(row.heroesOnField).toBeLessThan(squad.fieldSlots);
    // Defect D was masked for exactly this reason, on this account. It is still a defect: at
    // the old (wrong) reading the cap would have sat at 3, and a stronger roster would hit it.
    expect(squad.houseSlots).toBeLessThan(squad.fieldSlots);
  });
});

describe('the resulting rates', () => {
  it('clearSecs is ~77s, up from the pre-fix 67.5s', () => {
    expect(row.clearSecs).toBeCloseTo(77.29, 1);
    expect(row.clearSecs).toBeGreaterThan(70);
  });

  it('gold per prop matches telemetry to within 1.5% — the per-prop chain was never the problem', () => {
    const goldPerProp = row.goldPerHour / row.propsPerHour;
    expect(goldPerProp).toBeCloseTo(214.21, 2);
    expect(Math.abs(goldPerProp / OBSERVED_GOLD_PER_PROP - 1)).toBeLessThan(0.015);
  });

  it('goldPerHour is ~499k — down 12.7% from the pre-fix 571,546', () => {
    expect(row.goldPerHour).toBeCloseTo(498_898, -2);
    // A band, not a point, so a legitimate wiki-bundle refresh does not fail this file; tight
    // enough that re-opening any of the three defects moves the number out of it.
    expect(row.goldPerHour).toBeGreaterThan(490_000);
    expect(row.goldPerHour).toBeLessThan(510_000);
    expect(row.goldPerHour).toBeLessThan(571_546 * 0.95);
  });

  it('the residual over-prediction against telemetry is ~1.34x, and is HELD OPEN for the cadence capture', () => {
    const ratio = row.goldPerHour / OBSERVED_GOLD_PER_HOUR;
    expect(ratio).toBeGreaterThan(1.25);
    expect(ratio).toBeLessThan(1.45);
    // Guard against "fixing" this by tuning the cadence constants: if a future change closes the
    // gap, it must delete this assertion deliberately and say why — see the file header.
  });
});
