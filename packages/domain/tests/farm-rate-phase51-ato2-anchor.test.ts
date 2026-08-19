/**
 * The phase-51 ato-2 throughput anchor (issue #137, replacing the retired account-486 anchor).
 *
 * One real save (`sheet-math/save-20260818-12heroes.json`, 12 heroes, `phase: 51`, ato 2) pinned
 * against live telemetry captured beside it: 61 clears logged immediately after this export,
 * time-weighted (not per-clear — see the `clearSecs`/`heroesOnField` tests below for why that
 * distinction matters). The 61 samples are a fresh measurement, NOT drawn from any rolling
 * in-repo buffer, and are held out of band — in combat-throughput notes, not in this repo.
 *
 * This save is IN REGIME: it postdates both the 2026-08-15 crit-chance/CDR shape change and the
 * 2026-08-16 item-slot redistribution, and is one of the two captures
 * `points-within-level-budget.test.ts` names as reproducing today's sheet math (the other is
 * `save-20260819-respec-crit-cdr.json`).
 *
 * THE LESSON THE RETIRED FILE CARRIED, restated here so it survives the file that taught it: a
 * concurrency error and a cadence error can partly cancel into a `goldPerHour` figure that looks
 * plausible on its own. Asserting only the top-line number would have let that pass. So the chain
 * is pinned link by link — rest seconds, per-hero uptime, `uptimeSum`, House slot demand, heroes
 * on field, the field scale, clear time — and `goldPerHour` is asserted LAST, as a consequence of
 * everything above it, not as the thing itself being fitted.
 *
 * THE RESIDUAL HERE IS OPEN, ON PURPOSE, and it is a KNOWN, ATTRIBUTED gap, not slack in the
 * model. `heroesOnField`/`clearSecs`/`goldPerHour` all read ~6-8% low against measured telemetry,
 * in one consistent direction. Basis-(A) `computeTeamBuffsFromDeployed` — issue #132 — derives
 * team auras from who is `in_field` at the instant of export; on this roster (like the retired
 * file's) every carrier is `in_field: false` while `battle_allowed: true`, so the derived total is
 * zero even though those heroes cycle onto the field over the course of an hour. That is a
 * genuine open modelling question — full or partial aura COVERAGE across a rotation — filed as
 * issue #138, not a correction to the existing math this file anchors. Do not close this residual
 * by tuning a constant, widening a tolerance, or picking a different statistic; assert the current
 * model's own values and the documented gap to measured, exactly as the retired file did for its
 * open residual before the House-ceiling fix closed it.
 */
import { describe, expect, it } from 'vitest';
import { computeFarmRates } from '@bombfarm/domain/farm-rate';
import { wikiPhaseLine, goldRarityMult } from '@bombfarm/domain/phase-wiki';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const FIXTURE = 'save-20260818-12heroes.json';
const PHASE = 51;

/** Time-weighted mean clear seconds, 61 clears logged immediately after this export. The
 *  per-clear MEDIAN over the same window is 68s — NOT the comparator here: `clearSecs` models a
 *  time-weighted rate, and an earlier analysis that compared the modelled mean against the
 *  measured median got a spurious match. */
const OBSERVED_CLEAR_SECS = 85.9;
/** Time-weighted heroes-on-field mean, same window. The per-clear mean is 4.06 — over-represents
 *  fast clears the same way the median above does; time-weighted is the correct comparator. */
const OBSERVED_HEROES_ON_FIELD = 3.46;
/** Gold/hr banked over the same 61-clear window. */
const OBSERVED_GOLD_PER_HOUR = 3_610_194;
/** Direct client reading at this phase: a stone (rarity 1) banks ~1.03k gold. Three significant
 *  figures. */
const OBSERVED_GOLD_PER_STONE = 1030;
/** Direct client reading at this phase: a blue crystal (rarity 3) banks ~1.61k gold. Three
 *  significant figures. */
const OBSERVED_GOLD_PER_BLUE_CRYSTAL = 1610;

const { heroes, account, maxPhase } = loadFarmRateFixture(FIXTURE, 'sheet-math');
const { heroFacts, squad, rows } = computeFarmRates({ heroes, account, maxPhase });
const row = rows[PHASE - 1];

describe('the save is read as three distinct quantities', () => {
  it('all 12 heroes are in the pool, and the row under test is phase 51, ato 2', () => {
    expect(heroFacts).toHaveLength(12);
    expect(row.phase).toBe(PHASE);
    expect(row.ato).toBe(2);
    expect(account.context.phase).toBe(PHASE);
    expect(maxPhase).toBe(85);
  });

  it('houseCycleSecs is the save\'s own casa.cycle_secs (1067.37)', () => {
    expect(account.houseCycleSecs).toBeCloseTo(1067.36842105263, 8);
  });

  it('the House recovery cap (5) and the field cap (9) are read from different keys and are different numbers', () => {
    expect(squad.houseSlots).toBe(5); // casa.slots
    expect(squad.fieldSlots).toBe(9); // skills.field_slots
    expect(squad.fieldSlots).not.toBe(squad.houseSlots);
  });
});

describe('the House is the binding constraint', () => {
  it('Σ uptime is 3.8002 — comfortably under the roster size, so uptimeSum alone looks harmless', () => {
    expect(squad.uptimeSum).toBeCloseTo(3.8002, 4);
    expect(squad.uptimeSum).toBeLessThan(heroFacts.length);
  });

  it('yet the roster demands 8.1998 recovery slots against the 5 it owns — a 1.64x overcommit', () => {
    expect(squad.houseSlotDemand).toBeCloseTo(8.1998, 4);
    expect(squad.houseSlotDemand / squad.houseSlots).toBeCloseTo(1.63995, 3);
    expect(squad.houseSlotDemand).toBeGreaterThan(squad.houseSlots);
    // The identity the demand is derived from: Σ uptime + Σ (1 − uptime) === roster size.
    expect(squad.uptimeSum + squad.houseSlotDemand).toBeCloseTo(12, 9);
  });

  it('the greedy allocation lands heroesOnField at 3.2208 — ~6.9% below the time-weighted measured 3.46', () => {
    expect(row.heroesOnField).toBeCloseTo(3.2208, 4);
    // Strictly below the unconstrained sum: the constraint really bit.
    expect(row.heroesOnField).toBeLessThan(squad.uptimeSum);

    // OPEN, attributed to issue #138 (partial aura coverage across a rotation, not modelled by
    // basis-(A) computeTeamBuffsFromDeployed). Documented, not tuned away.
    const residual = row.heroesOnField / OBSERVED_HEROES_ON_FIELD - 1;
    expect(residual).toBeCloseTo(-0.0691, 3);
  });

  it('the field cap is NOT what binds here — 9 slots against 3.22 heroes on field', () => {
    expect(row.concurrencyScale).toBe(1);
    expect(row.heroesOnField).toBeLessThan(squad.fieldSlots);
  });
});

describe('the resulting rates', () => {
  it('clearSecs is 92.78s — ~8.0% above the time-weighted measured mean of 85.9s (NOT the 68s per-clear median)', () => {
    expect(row.clearSecs).toBeCloseTo(92.7798, 4);

    // OPEN, same attribution as heroesOnField above (issue #138): fewer heroes on field than
    // measured means slower modelled clears than measured, consistently.
    const residual = row.clearSecs / OBSERVED_CLEAR_SECS - 1;
    expect(residual).toBeCloseTo(0.0801, 3);

    // The median (68s) is a different statistic from the time-weighted mean this model produces
    // — asserted here as a guard against re-introducing the comparison an earlier analysis got
    // a spurious match from.
    expect(row.clearSecs).toBeGreaterThan(68);
  });

  it('goldPerHour is ~3.387M — ~6.2% below the measured 3,610,194, the same open residual carried through', () => {
    expect(row.goldPerHour).toBeCloseTo(3_387_040, -2);

    // OPEN, same attribution (issue #138). Two-sided is not appropriate here — this is a known,
    // one-directional gap being tracked, not a tolerance band the model is expected to sit
    // inside. Left as a point comparison so any UNRELATED move (a wiki refresh, a sheet-math
    // change) shows up as a change to THIS number, distinct from the tracked residual itself.
    const residual = row.goldPerHour / OBSERVED_GOLD_PER_HOUR - 1;
    expect(residual).toBeCloseTo(-0.0618, 3);
  });

  it('gold per stone (rarity 1) matches the direct client reading (1.03k) to within 1%', () => {
    const line = wikiPhaseLine(PHASE)!;
    const teamCoinMult = 1 + Math.max(0, account.tree.teamCoinPct ?? 0) / 100;
    const goldComumActual = line.goldComum * teamCoinMult;
    const goldPerStone = goldComumActual * goldRarityMult(1);

    expect(goldPerStone).toBeCloseTo(1037.859375, 4);
    expect(Math.abs(goldPerStone / OBSERVED_GOLD_PER_STONE - 1)).toBeLessThan(0.01);
  });

  it('gold per blue crystal (rarity 3) matches the direct client reading (1.61k) to ~1.3% — outside the stone check\'s 1%, both readings are three-significant-figure', () => {
    const line = wikiPhaseLine(PHASE)!;
    const teamCoinMult = 1 + Math.max(0, account.tree.teamCoinPct ?? 0) / 100;
    const goldComumActual = line.goldComum * teamCoinMult;
    const goldPerBlueCrystal = goldComumActual * goldRarityMult(3);

    expect(goldPerBlueCrystal).toBeCloseTo(1630.921875, 4);
    // Genuinely 1.2995%, not 1%: documented rather than forced. The two readings' OWN implied
    // goldComumActual values (735.71 from the stone reading, 731.82 from the blue-crystal
    // reading) already differ from each other by ~0.53%, consistent with both being rounded to
    // three significant figures — this model's 741.33 sits a little above both, closer to the
    // stone reading's implied value than the blue crystal reading's.
    expect(Math.abs(goldPerBlueCrystal / OBSERVED_GOLD_PER_BLUE_CRYSTAL - 1)).toBeLessThan(0.013);
  });
});

describe('grito de guerra and fôlego de mineiro anchor different terms — do not conflate them', () => {
  it('heroesOnField is bit-identical whether grito_guerra reads 0 or 20 — grito is damage-only, not duty-cycle', () => {
    const off = computeFarmRates({
      heroes,
      account: { ...account, teamBuffs: { ...account.teamBuffs, grito_guerra: 0 } },
      maxPhase,
    }).rows[PHASE - 1];
    const on = computeFarmRates({
      heroes,
      account: { ...account, teamBuffs: { ...account.teamBuffs, grito_guerra: 20 } },
      maxPhase,
    }).rows[PHASE - 1];

    expect(on.heroesOnField).toBe(off.heroesOnField);
    // Grito's effect shows up in goldPerHour (via damage/clear speed), not heroesOnField.
    expect(on.goldPerHour).not.toBe(off.goldPerHour);
    expect(on.goldPerHour).toBeGreaterThan(off.goldPerHour);
  });

  it('heroesOnField DOES move with fôlego de mineiro — fôlego is duty-cycle (drain), not damage', () => {
    const off = computeFarmRates({
      heroes,
      account: { ...account, teamBuffs: { ...account.teamBuffs, folego_mineiro: 0 } },
      maxPhase,
    }).rows[PHASE - 1];
    const on = computeFarmRates({
      heroes,
      account: { ...account, teamBuffs: { ...account.teamBuffs, folego_mineiro: 20 } },
      maxPhase,
    }).rows[PHASE - 1];

    expect(on.heroesOnField).not.toBe(off.heroesOnField);
    expect(on.heroesOnField).toBeGreaterThan(off.heroesOnField);
  });
});
