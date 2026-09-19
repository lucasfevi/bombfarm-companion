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
 * ONE CONSTANT HAS MOVED UNDER IT SINCE: the 2026-09-12 wiki publishes Misericórdia at 0.75% of
 * HP per level (was 1.25%), and four of these heroes carry it. The three rate pins below were
 * re-pinned to the new arithmetic (clear time +0.2%, gold/hr −0.2%), not refitted — the same
 * treatment the Baton Pass pricing got. The capture predates the change, so the measured side
 * still describes the larger threshold; the residuals carry that until the pair is re-anchored.
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
 * THE +7.5% GOLD RESIDUAL WAS TWO ERRORS CANCELLING, exactly, and that is the failure this file
 * exists to catch. It factored as presence 0.93072 × cadence 1.15500 = 1.07499: the model put ~7%
 * fewer heroes on the field than measured and ran each of them ~15% fast, and the product looked
 * like a modest 7.5% overshoot. Charging every clear for the head the squad spends coming up to
 * speed — the staggered hero activations plus the opening bomb fuse, neither of which the
 * steady-state cycle charges — takes the cadence factor to ~+0.8%. What remains is the presence
 * term alone, so the gold residual is now one named error rather than two hiding each other. Both
 * factors are asserted below rather than described, so the decomposition cannot silently stop
 * holding.
 *
 * `heroesOnField` IS UNTOUCHED at -6.9%, deliberately. It is a separate open question, and fixing
 * one term per change is what keeps either judgeable.
 *
 * PASSAGEM DE BASTÃO IS PRICED SINCE 2026-09-12, and the anchor was fitted with it absent. It is
 * a team aura up in pulses: this roster carries exactly one rank-20 carrier (Perrin), whose
 * ~1729 s rotation cycle at this House keeps the whole field at x1.8 for 120 s of every cycle —
 * 6.9% of wall clock, for all ~7.4 heroes on it. That moved clear time -0.97% and gold +0.98%,
 * and the cadence factor from 1.00802 to 1.01792. Recorded, not absorbed: no constant was
 * refitted to put the figures back, so the residual below now includes what the ability is
 * worth here. (Priced on the carrier alone it was +0.18%; the wiki's own scope column says the
 * field, and that reading is the one shipped.)
 *
 * AN EARLIER VERSION OF THIS HEADER BLAMED "the effective walk-distance constant fitted at ato-5
 * prop density running optimistic at the lower densities of ato 2". Both halves were wrong and the
 * claim is retired: that constant no longer exists, the shipped hop histogram is fitted at ato 1,
 * and ato 2 is DENSER than ato 1, not lighter. Swinging the density exponent across its whole
 * bootstrap interval moves this row by 0.241 s — about 1% of clear time against what was then a
 * 15% residual — so it was never the explanation and is not the fix.
 *
 * THE MEASURED SIDE IS AN UPPER BOUND. The telemetry comes from an automated account: its
 * strongest heroes take a House slot the instant they empty rather than queueing, and its
 * drain-aura carriers are deliberately staggered so one is almost always up. The model assumes
 * neither.
 *
 * AND THE GOLD COMPARATOR IS THE WEAKEST LINK IN THIS FILE — treat its residual as an order of
 * magnitude, never a precise figure. It cannot be checked against anything else, and its own
 * sub-windows are internally inconsistent: gold/hr RISES across them (19.03M over the full three
 * hours, 22.4M over the last hour, 26.8M over the clears immediately after the export) while the
 * cadence they describe FALLS — arithmetic clear length goes 27.49s → 29.12s → 33.53s and
 * heroes-on-field 7.93 → 7.46 → 6.18 as the roster drains from 9 heroes to 6 before the session
 * ends. Slower clears with fewer heroes cannot bank more gold per hour, so at least one side of
 * that stream is not measuring what it is read as. This header used to attribute the rise to the
 * roster levelling through the window; levelling is real but day-scale, and the clear stream shows
 * the opposite happening inside these three hours. The full window is used because it is the
 * longest and the most stable, not because it is corroborated.
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

/**
 * ARITHMETIC mean ACTIVE clear seconds over the post-patch phase-51 window (301 clears once the
 * stalls are dropped; every remaining sample is 5.98–53.98s). The per-clear MEDIAN over the same
 * window is 27s and is not the comparator either.
 *
 * WHY THE ARITHMETIC MEAN, AND WHY THIS FILE PINNED THE WRONG STATISTIC UNTIL NOW. `clearSecs` is
 * a rate reciprocal, and the identity settles which mean inverts to that rate: total props over
 * total active seconds is `propCount / arithmetic mean`, so the arithmetic mean IS the reciprocal
 * of the measured rate. The time-weighted mean `Σt² / Σt` answers a different question — how long
 * the clear a randomly chosen second falls inside lasts — and is length-biased upward by the
 * spread. On this window that bias is 4.56% (28.795s time-weighted against 27.483s arithmetic),
 * and the 28.77 this file used to pin reproduces the time-weighted figure. Comparing a modelled
 * rate against it understated the model's speed by that much.
 */
const OBSERVED_CLEAR_SECS = 27.483;
/**
 * TIME-WEIGHTED heroes-on-field mean, same window — and time-weighting is right for THIS figure,
 * where it was wrong for the one above. Mean occupancy is itself the length-biased question ("how
 * many heroes is a randomly chosen second sharing?"), and the model's `heroesOnField` is a
 * steady-state mean over wall clock, so the two are the same quantity. A per-clear mean would
 * instead give every clear one vote regardless of how long it held those heroes.
 */
const OBSERVED_HEROES_ON_FIELD = 7.913;
/** Gold/hr banked over the same window, time-weighted by wall clock (rest included). The weakest
 *  comparator in this file — see the header on why its own sub-windows contradict each other. */
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
    // Negative, where the retired pair read +4.1%. Recorded, not tuned, and deliberately left
    // alone by the head-term change: it is the one term still carrying the gold residual, and
    // moving two at once would make neither judgeable.
    const residual = row.heroesOnField / OBSERVED_HEROES_ON_FIELD - 1;
    expect(residual).toBeCloseTo(-0.0693, 3);
  });
});

describe('the resulting rates', () => {
  // RE-PINNED 2026-09-19 for the standing-props clear (ADR-017): the row no longer prices a
  // constant kill rate from a crit-averaged hit but integrates over the props left standing,
  // with the crit rolled per hit. Before that change this row read 27.7041s and 17,997,272 gold/h
  // (clear +0.8%, gold -5.4%) — right by cancellation, its own note said. It now reads slower.
  it('clearSecs is 29.98s — ~9.1% above the measured arithmetic mean of 27.483s', () => {
    expect(row.clearSecs).toBeCloseTo(29.9791, 3);

    const residual = row.clearSecs / OBSERVED_CLEAR_SECS - 1;
    expect(residual).toBeCloseTo(0.0908, 3);
    expect(row.clearSecs).toBeGreaterThan(OBSERVED_CLEAR_SECS);
  });

  it('goldPerHour is ~16.63M — ~12.6% BELOW the measured 19,033,500', () => {
    // Left as a point comparison rather than a tolerance band, so that any UNRELATED move (a wiki
    // refresh, a sheet-math change) shows up as a change to THIS number, distinct from the
    // tracked residual itself.
    expect(row.goldPerHour).toBeCloseTo(16_631_491, -3);

    const residual = row.goldPerHour / OBSERVED_GOLD_PER_HOUR - 1;
    expect(residual).toBeCloseTo(-0.1262, 3);
  });

  it('the gold residual is presence × cadence, both reading low — no cancellation hides either', () => {
    // The two factors whose product IS the gold residual. `presence` is the heroes-on-field
    // residual asserted above; `cadence` is everything else. Under the retired row cadence read
    // 1.155 against presence 0.931 and the top line looked like +7.5%; with the head charged it
    // read 1.016; the standing-props clear reads 0.939 on this pair — 6% slow on an early-game
    // roster of slow, reach-1 heroes, the regime the model's constants were least measured on
    // (they come from frames of a mid-game field at two densities). Recorded, not fitted away:
    // the same model sits within 2% of this capture's clear once the measured presence is fed
    // in, so the cadence term here is the part still open.
    const presence = row.heroesOnField / OBSERVED_HEROES_ON_FIELD;
    const goldFactor = row.goldPerHour / OBSERVED_GOLD_PER_HOUR;
    const cadence = goldFactor / presence;

    expect(presence).toBeCloseTo(0.93072, 4);
    expect(cadence).toBeCloseTo(0.93884, 4);
    expect(presence * cadence).toBeCloseTo(goldFactor, 12);
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
