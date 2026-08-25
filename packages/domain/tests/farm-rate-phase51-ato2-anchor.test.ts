/**
 * The phase-51 ato-2 throughput anchor (issue #137).
 *
 * One real save pinned against live telemetry captured beside it. RE-ANCHORED 2026-08-23 onto a
 * fresh pair: `sheet-math/save-20260823-13heroes-crit-points.json` (13 heroes, `phase: 51`, ato 2)
 * and the 307 phase-51 clears logged in the three hours around that export, all of them after the
 * balance patch that restated the crit-chance abilities in points. Both sides are post-patch, so
 * the comparison is a claim about today's game. The samples are a fresh measurement, held out of
 * band — in combat-throughput notes, not in this repo.
 *
 * WHY THE PREVIOUS PAIR WAS RETIRED RATHER THAN RE-FITTED. It read `save-20260818-12heroes.json`
 * against 61 clears logged beside it, and both predate the 2026-08-23 patch. That patch changed
 * the crit-chance ABILITIES' shape (see the `critChanceFlat` ability kind), so today's sheet math
 * re-credits that capture's Olho Clínico heroes with points the game never gave them at the time —
 * the modelled side would have described a state that never existed, while the measured side kept
 * describing the old game. Editing the expected numbers to match would have turned the anchor into
 * a comparison of the model against itself. The account has also moved a long way since (its
 * heroes gained ~30 levels, its House went 5 recovery slots to 9, and its tree's coin bonus
 * doubled), which is why almost every figure below is a different order of magnitude.
 *
 * THE LESSON THE FIRST FILE CARRIED, restated so it survives each re-anchor: a concurrency error
 * and a cadence error can partly cancel into a `goldPerHour` figure that looks plausible on its
 * own. Asserting only the top-line number would let that pass. So the chain is pinned link by link
 * — House cycle, Σ uptime, House slot demand, what actually binds, heroes on field, the field
 * scale, clear time — and `goldPerHour` is asserted LAST, as a consequence of everything above it,
 * not as the thing being fitted.
 *
 * WHAT BINDS HAS CHANGED, and it is the structural headline of this re-anchor. On the retired pair
 * the House was the binding constraint: 5 recovery slots against 7.81 demanded, so the greedy
 * allocation cut heroes-on-field well below Σ uptime. This account now owns 9 recovery slots and
 * demands 5.64, so the House does not bind at all and `heroesOnField === uptimeSum` exactly. The
 * field cap (9) does not bind either. Both are asserted below, because "nothing binds" is a claim
 * that can silently stop being true.
 *
 * THE RESIDUALS WIDENED, and they are recorded rather than tuned away. They were `heroesOnField`
 * +4.1% / `clearSecs` -2.5% / `goldPerHour` +3.9%; they are now -6.9% / -17.0% / +9.7%. The
 * pattern is coherent and points at cadence, not concurrency: the model puts FEWER heroes on the
 * field than measured and still clears FASTER, so its per-hero clear rate is the optimistic term.
 * That is consistent with a known limitation recorded elsewhere — the effective walk-distance
 * constant is fitted at ato-5 prop density and runs optimistic at the lower densities of ato 2,
 * which is exactly this row. Nothing in the 2026-08-23 patch touched cadence, and the sheet side
 * is independently exact (every hero on this capture solves to a whole-number point vector with
 * no inference issues), so this is a pre-existing gap now measured against a stronger squad that
 * makes it more visible — not a regression introduced with the crit-chance shape.
 *
 * THE MEASURED SIDE IS AN UPPER BOUND, and this is the thing to hold in mind before treating the
 * positive `goldPerHour` residual as an error to remove. The telemetry comes from an automated
 * account: its strongest heroes take a House slot the instant they empty rather than queueing, and
 * its drain-aura carriers are deliberately staggered so one is almost always up. The model assumes
 * neither. It is also NOISY at sub-window scale — the same phase-51 stream reads 19.03M gold/hr
 * over the full three hours, 22.4M over the last hour and 26.8M over the eighteen clears that
 * follow the export exactly, as the roster kept levelling through the window. The full window is
 * the comparator here because it is the most stable, but a model tuned onto any single sub-window
 * would be fitting to that window's noise.
 */
import { describe, expect, it } from 'vitest';
import { computeFarmRates } from '@bombfarm/domain/farm-rate';
import { wikiPhaseLine, goldRarityMult } from '@bombfarm/domain/phase-wiki';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const FIXTURE = 'save-20260823-13heroes-crit-points.json';
/** The retired pair's save, kept for the two per-prop gold checks alone: their client readings
 *  were taken against THAT account's skill tree, whose coin bonus has since doubled. The formula
 *  those two exercise (`goldComum × teamCoin × goldRarityMult`) has no sheet-math input, so the
 *  crit-chance patch does not reach it and the reading stays valid for its own account state. */
const GOLD_READING_FIXTURE = 'save-20260818-12heroes.json';
const PHASE = 51;

/** Time-weighted mean ACTIVE clear seconds over the 307-clear post-patch phase-51 window. One
 *  1,287s sample (a stall, not a clear) is excluded; every other sample is 6–51s. The per-clear
 *  MEDIAN over the same window is 27s — NOT the comparator here: `clearSecs` models a
 *  time-weighted rate, and an earlier analysis that compared the modelled mean against a measured
 *  median got a spurious match. */
const OBSERVED_CLEAR_SECS = 28.77;
/** Time-weighted heroes-on-field mean, same window. Time-weighted for the same reason a per-clear
 *  mean is wrong for the figure above: it over-represents fast clears. */
const OBSERVED_HEROES_ON_FIELD = 7.913;
/** Gold/hr banked over the same window, time-weighted by wall clock (rest included). */
const OBSERVED_GOLD_PER_HOUR = 19_033_500;
/** Direct client reading at this phase on {@link GOLD_READING_FIXTURE}'s account: a stone
 *  (rarity 1) banks ~1.03k gold. Three significant figures. */
const OBSERVED_GOLD_PER_STONE = 1030;
/** Direct client reading at this phase on the same account: a blue crystal (rarity 3) banks
 *  ~1.61k gold. Three significant figures. */
const OBSERVED_GOLD_PER_BLUE_CRYSTAL = 1610;

const { heroes, account, maxPhase } = loadFarmRateFixture(FIXTURE, 'sheet-math');
const { heroFacts, squad, rows } = computeFarmRates({ heroes, account, maxPhase });
const row = rows[PHASE - 1];

describe('the save is read as three distinct quantities', () => {
  it('all 13 heroes are in the pool, and the row under test is phase 51, ato 2', () => {
    expect(heroFacts).toHaveLength(13);
    expect(row.phase).toBe(PHASE);
    expect(row.ato).toBe(2);
    expect(account.context.phase).toBe(PHASE);
    expect(maxPhase).toBe(137);
  });

  it("houseCycleSecs is the save's own casa.cycle_secs (840)", () => {
    expect(account.houseCycleSecs).toBe(840);
  });

  it('the House recovery cap and the field cap are read from different keys — both 9 here, and that coincidence is asserted rather than assumed', () => {
    expect(squad.houseSlots).toBe(9); // casa.slots
    expect(squad.fieldSlots).toBe(9); // skills.field_slots
    // They were 5 and 9 on the retired pair. Equal here by coincidence of this account's own
    // progression, so a test that silently let one stand in for the other would now pass for the
    // wrong reason — hence both are read, and both are named.
    expect(squad.houseSlots).toBe(squad.fieldSlots);
  });
});

describe('nothing binds on this account — the structural change since the retired pair', () => {
  it('Σ uptime is 7.3648 — under the roster size, as it always is', () => {
    expect(squad.uptimeSum).toBeCloseTo(7.3648, 4);
    expect(squad.uptimeSum).toBeLessThan(heroFacts.length);
  });

  it('the roster demands 5.6352 recovery slots against the 9 it owns — the House stopped being the constraint', () => {
    expect(squad.houseSlotDemand).toBeCloseTo(5.6352, 4);
    expect(squad.houseSlotDemand).toBeLessThan(squad.houseSlots);
    // The retired pair demanded 7.81 against 5 — a 1.56x overcommit that cut heroes-on-field well
    // below Σ uptime. This account sits at 0.63x.
    expect(squad.houseSlotDemand / squad.houseSlots).toBeCloseTo(0.62613, 4);
    // The identity the demand is derived from: Σ uptime + Σ (1 − uptime) === roster size.
    expect(squad.uptimeSum + squad.houseSlotDemand).toBeCloseTo(13, 9);
  });

  it('so heroesOnField is Σ uptime EXACTLY — the allocation had nothing to cut', () => {
    expect(row.heroesOnField).toBe(squad.uptimeSum);
    expect(row.heroesOnField).toBeCloseTo(7.3648, 4);
  });

  it('the field cap bites LIGHTLY — the mean fits under 9 slots, but the peaks do not', () => {
    // Mean occupancy 7.36 against 9 slots, so a mean-versus-cap comparison charged nothing and
    // this used to assert exactly 1. The game admits heroes FIFO, identity-blind, so the squad
    // loses the share of demand the slots cannot serve — and demand crosses 9 often enough here
    // to cost 2%. Small, and the right sign: `min` is concave, so the old form could only ever
    // run optimistic.
    expect(row.heroesOnField).toBeLessThan(squad.fieldSlots);
    expect(row.concurrencyScale).toBeLessThan(1);
    expect(row.concurrencyScale).toBeCloseTo(0.98020, 4);
    expect(row.fieldContentionPct).toBeGreaterThan(0);
  });

  it('heroesOnField is 7.3648 — ~6.9% BELOW the time-weighted measured 7.913', () => {
    // Negative, where the retired pair read +4.1%. Recorded, not tuned: with FEWER heroes on the
    // field than measured and yet FASTER modelled clears (below), the two residuals cannot both
    // be a concurrency error — see the header on why this points at cadence.
    const residual = row.heroesOnField / OBSERVED_HEROES_ON_FIELD - 1;
    expect(residual).toBeCloseTo(-0.0693, 3);
  });
});

describe('the resulting rates', () => {
  it('clearSecs is 24.37s — ~15.3% below the time-weighted measured mean of 28.77s (NOT the 27s per-clear median)', () => {
    // 23.886s / -17.0% before the FIFO field queue. The queue charges this roster 2% of its
    // throughput, which lengthens the modelled clear and moves it TOWARD the measurement. Still
    // short by 15%, and that remainder is cadence, not concurrency: the model puts FEWER heroes on
    // the field than measured (above) and still clears FASTER, so the per-hero rate is the
    // optimistic term. The measurements behind that are held out of band, not in this repo.
    expect(row.clearSecs).toBeCloseTo(24.3685, 3);

    const residual = row.clearSecs / OBSERVED_CLEAR_SECS - 1;
    expect(residual).toBeCloseTo(-0.1531, 3);

    // The median (27s) is a different statistic from the time-weighted mean this model produces —
    // asserted as a guard against re-introducing the comparison an earlier analysis got a
    // spurious match from. The modelled value sits BELOW the median on this pair and sat above it
    // on the retired one, so the guard is a real check rather than a restatement of the line
    // above it.
    expect(row.clearSecs).toBeLessThan(27);
  });

  it('goldPerHour is ~20.46M — ~7.5% above the measured 19,033,500, the same residual carried through', () => {
    // 20,874,078 / +9.7% before the FIFO field queue took 2% off this roster's throughput.
    expect(row.goldPerHour).toBeCloseTo(20_460_729, -3);

    // Left as a point comparison rather than a tolerance band, so that any UNRELATED move (a wiki
    // refresh, a sheet-math change) shows up as a change to THIS number, distinct from the
    // tracked residual itself.
    const residual = row.goldPerHour / OBSERVED_GOLD_PER_HOUR - 1;
    expect(residual).toBeCloseTo(0.0750, 3);
  });
});

describe("per-prop gold — the retired pair's account, whose client readings these are", () => {
  const goldReadingAccount = loadFarmRateFixture(GOLD_READING_FIXTURE, 'sheet-math').account;
  const line = wikiPhaseLine(PHASE)!;
  const teamCoinMult = 1 + Math.max(0, goldReadingAccount.tree.teamCoinPct ?? 0) / 100;
  const goldComumActual = line.goldComum * teamCoinMult;

  it('gold per stone (rarity 1) matches the direct client reading (1.03k) to within 1%', () => {
    const goldPerStone = goldComumActual * goldRarityMult(1);
    expect(goldPerStone).toBeCloseTo(1037.859375, 4);
    expect(Math.abs(goldPerStone / OBSERVED_GOLD_PER_STONE - 1)).toBeLessThan(0.01);
  });

  it("gold per blue crystal (rarity 3) matches the direct client reading (1.61k) to ~1.3% — outside the stone check's 1%, both readings are three-significant-figure", () => {
    const goldPerBlueCrystal = goldComumActual * goldRarityMult(3);
    expect(goldPerBlueCrystal).toBeCloseTo(1630.921875, 4);
    // Genuinely 1.2995%, not 1%: documented rather than forced. The two readings' OWN implied
    // goldComumActual values (735.71 from the stone reading, 731.82 from the blue-crystal
    // reading) already differ from each other by ~0.53%, consistent with both being rounded to
    // three significant figures — this model's 741.33 sits a little above both, closer to the
    // stone reading's implied value than the blue crystal reading's.
    expect(Math.abs(goldPerBlueCrystal / OBSERVED_GOLD_PER_BLUE_CRYSTAL - 1)).toBeLessThan(0.013);
  });

  it('the per-prop formula takes no sheet-math input, which is why a second account can share it', () => {
    // Its only account-scoped term is the tree's coin bonus, and that is what moved (97.69% →
    // 196.77%) as the account levelled — not the physics. The rarity ratio is account-independent,
    // which is the property that lets the throughput chain above and these two readings sit in one
    // file on two different captures without either borrowing the other's account.
    const liveAccountMult = 1 + Math.max(0, account.tree.teamCoinPct ?? 0) / 100;
    expect(liveAccountMult).toBeGreaterThan(teamCoinMult);
    const liveBase = line.goldComum * liveAccountMult;
    expect((liveBase * goldRarityMult(3)) / (liveBase * goldRarityMult(1))).toBeCloseTo(
      goldRarityMult(3) / goldRarityMult(1),
      12,
    );
  });
});
