/**
 * Proof that the `farm-rate.ts` basis seam is a byte-identical refactor, not a rewrite.
 *
 * RE-RECORDED 2026-08-23 for the crit-chance ability shape (Olho Clínico and Presságio Mortal
 * restated in flat crit POINTS) and, on the gate rows only, the refreshed stone/time chest rates.
 * Diffed field by field against the previous capture:
 *
 * - `heroFacts` — exactly ONE field moved, `avgHitBase`, and only on the 2 of 5 heroes carrying
 *   Olho Clínico (Bellatrix and Jon, both rank 20). That is the whole correct footprint: the
 *   ability is a crit-chance term, crit chance reaches throughput only through the average hit,
 *   and nothing else in `heroFacts` depends on it. `uptime` is byte-identical on all 5 — the
 *   load-bearing negative, since drain is untouched by this patch and an `uptime` move would mean
 *   the change had leaked into the energy path. `penetrationPct`, `fuseSecs`, `walkSpeedCells`,
 *   `cycleSecs`, `plantsPerSec`, `plantsPerSecByAto`, `blocksPerBomb`, `heroLuckPct`,
 *   `veiaOuroLevel`, `fortunaLevel` and `degenerate` are byte-identical too.
 * - `rows` — every throughput column downstream of the hit moved on the 580 reachable rows
 *   (row 42: 118,767 → 138,139 gold/hr, `clearSecs` 478.6 → 411.5 — a rank-20 Olho hero's crit
 *   rate goes from `roll + 43%` to `roll + 40 points`, so the squad clears materially faster).
 *   `stoneChestsPerHour` and `timePiecesPerHour` moved on all 60 GATE rows for a second,
 *   independent reason — the wiki refresh took the stone chest from 0.005% to 0.05% and the time
 *   chest from 0.15% to 0.1%; `gemsPerHour` moved on 59 of those from the clear-rate change
 *   alone, its own rate being unchanged. `heroesOnField` moved on only 4 rows, `mitigationPct`,
 *   `ato`, `gate`, `locked`, `oneShot`, `infeasible`, `itemLevels`, `itemLevelLabel`,
 *   `jaulaEarlyCapPct`, `jaulaWindowSecs`, `gateTimerSecs`, `fortunaAura` and `concurrencyScale`
 *   not at all.
 *
 * RE-RECORDED 2026-08-21 for the additive drain-reduction fix: a hero's own drain reduction and
 * the team's used to be combined multiplicatively; measurement showed they add instead, each
 * capped at 20%, floored at a combined 60%. Jon is this corpus's only hero with both arms —
 * Bateria Extra rank 20 (self, capped at 20%) and Fôlego de Mineiro rank 18 (team, 18%) — so his
 * own combined rate moves from 0.8 × 0.82 = 0.656 to 1 − 0.20 − 0.18 = 0.62. Diffed field by
 * field against the previous capture:
 *
 * - `heroFacts.uptime` moved on all 5 heroes: Jon's own move is the large one, and because
 *   auras are priced over the rotation (weighted by every hero's uptime), his slightly changed
 *   presence weight ripples a smaller, second-order move into the shared roster-wide Fôlego
 *   total the other 4 heroes read — none of whom carry a drain ability of their own.
 *   `avgHitBase`, `penetrationPct`, `fuseSecs`, `walkSpeedCells`, `cycleSecs`, `plantsPerSec`,
 *   `blocksPerBomb`, `heroLuckPct`, `veiaOuroLevel`, `fortunaLevel` and `degenerate` are
 *   byte-identical — the fix touches drain and nothing upstream of it.
 * - `rows` — every throughput column downstream of uptime moved on all 600 rows
 *   (`goldPerHour`, `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`,
 *   `stoneChestsPerHour`, `xpPerHour`, `propsPerHour`, `cyclesPerHour`, `clearSecs`,
 *   `expectedHtk`, `heroesOnField`). `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`,
 *   `infeasible`, `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`, `jaulaWindowSecs`,
 *   `gateTimerSecs`, `fortunaAura` and `concurrencyScale` are byte-identical.
 *
 * RE-RECORDED 2026-08-20 for two changes at once — team auras priced over the ROTATION rather
 * than off the deployed line-up (`computeTeamBuffsOverRotation`), and the `HOP_DENSITY_EXPONENT`
 * refit (0.5 → 0.124). Diffed field by field against the previous capture:
 *
 * - `heroFacts` — exactly two fields moved, one per change. `uptime` rose on all 5 heroes
 *   (Jon 0.2505 → 0.2607, Bellatrix 0.3187 → 0.3304) because this corpus is the MIRROR case of
 *   the defect: its `account.teamBuffs` is all-zero (no hero is deployed), yet Jon carries Fôlego
 *   de Mineiro rank 18 and sits in the rotation pool, so the board used to grant the roster none
 *   of an aura it genuinely runs on for a quarter of every rotation and now prices it at 5.21.
 *   `plantsPerSecByAto` moved on all 5 from the exponent refit. `avgHitBase` did NOT move, which
 *   is the load-bearing negative: no hero in this corpus carries Grito de Guerra, so the aura
 *   change must not touch a damage term here — and it does not.
 * - `rows` — every throughput column moved on all 600 rows (row 42: 113,791 → 118,196 gold/hr,
 *   clearSecs 499.57 → 480.95), as both changes reach throughput. Every structural column
 *   (`mitigationPct`, `ato`, `gate`, `locked`, `oneShot`, `gateTimerSecs`, `jaulaEarlyCapPct`,
 *   `jaulaWindowSecs`, `phase`, `itemLevels`, `itemLevelLabel`, `concurrencyScale`,
 *   `fortunaAura`) is untouched. `concurrencyScale` staying put confirms the field cap is still
 *   not binding on this corpus; `fortunaAura` staying put confirms no hero here carries Fortuna.
 *
 * RE-RECORDED 2026-08-19 (second pass) for issue #132's team-aura roster shape. This fixture's
 * `account.teamBuffs` is `zeroTeamBuffs()` (farm-rate-fixtures.ts reproduces production's
 * post-import default, before the team-buffs auto-fill button is ever pressed), and Jon (the
 * corpus's only Fôlego de Mineiro carrier, rank 18) previously had his own rank silently boost
 * his own drain regardless of that zero — the exact double-count the fix removes. Diffed field
 * by field against the previous capture:
 *
 * - `heroFacts` — ONLY Jon's own `uptime` moved (0.2896 → 0.2505); every other per-hero field,
 *   on Jon and on the other 4 heroes, is byte-identical. That is the correct footprint: uptime is
 *   the one heroFacts field drain touches, and drain is per-hero.
 * - `rows` — every throughput column moved on all 600 rows, because `heroesOnField` (the
 *   squad-level House allocation) is a function of every hero's uptime together — Jon's own drop
 *   ripples into the whole squad's concurrency split even though the other 4 heroes' own facts
 *   did not move. Every structural column (`mitigationPct`, `ato`, `gate`, `locked`, `oneShot`,
 *   `gateTimerSecs`, `jaulaEarlyCapPct`, `jaulaWindowSecs`, `phase`, `itemLevels`,
 *   `itemLevelLabel`, `concurrencyScale`, `fortunaAura`) is untouched.
 *
 * RE-RECORDED 2026-08-19 for the crit-chance/CDR revert (issue #132 — the 2026-08-18 patch put
 * both back to percent-of-base, three days after the 2026-08-15 patch that made them flat).
 * Diffed field by field against the previous capture before rewriting:
 *
 * - `heroFacts` — `avgHitBase`, `fuseSecs`, `cycleSecs`, `plantsPerSec` and `plantsPerSecByAto`
 *   moved on some/all of the 5 heroes — every one of them downstream of the hero's crit
 *   multiplier, which is exactly what changed. No field unrelated to combat throughput moved.
 * - `rows` — every throughput column moved on all 600 rows (`goldPerHour`, `chestsPerHour`,
 *   `keysPerHour`, `xpPerHour`, `propsPerHour`, `cyclesPerHour`, `clearSecs`, `expectedHtk`,
 *   `gemsPerHour`, `timePiecesPerHour`, `stoneChestsPerHour`), plus `heroesOnField` (the House
 *   allocation re-ranks slightly when hero throughput moves). Every structural column —
 *   `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`, `gateTimerSecs`, `jaulaEarlyCapPct`,
 *   `jaulaWindowSecs`, `phase`, `itemLevels`, `itemLevelLabel`, `concurrencyScale`,
 *   `fortunaAura` — is untouched, which is the signature of a damage-model change and not a
 *   table change.
 *
 * PREVIOUSLY RE-RECORDED 2026-08-18 for the per-ato hop-density rescale (`hopScaleForAto` — `HOP_DISTRIBUTION`
 * is measured at ato 1's 50 props and was previously applied unscaled to every ato). Diffed field
 * by field against the previous capture before rewriting, and the footprint is exactly the change:
 *
 * - `heroFacts` — **only the new `plantsPerSecByAto` appeared**; every pre-existing field on all
 *   5 heroes is byte-identical, `cycleSecs` and `plantsPerSec` included. Those two are defined at
 *   the fit ato, so the rescale cannot move them — that is what makes them the control here.
 * - `rows` — **ato 1's 50 rows are byte-identical, every column.** Ato 1 IS the measurement, so a
 *   diff there would have meant the rescale was not identity at its own fit point. The other 550
 *   rows move on the throughput columns only (`clearSecs`, `propsPerHour`, `cyclesPerHour`,
 *   `goldPerHour`, `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`,
 *   `stoneChestsPerHour`, `xpPerHour`, and `expectedHtk` — the last because the House allocation
 *   re-ranks slightly when plant rates do). `clearSecs` falls by a single factor within each ato:
 *   x0.9101 at ato 2, x0.8635 at ato 3, x0.8188 at ato 4, x0.7986 at ato 5 — monotone in prop
 *   density and flat within an ato, which is the shape a geometric rescale must have. Anything
 *   varying inside one ato would have meant a phase-dependent term had leaked in.
 * - `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`, `gateTimerSecs`, `jaulaEarlyCapPct`,
 *   `jaulaWindowSecs`, `phase`, `itemLevels`, `itemLevelLabel`, `heroesOnField`,
 *   `concurrencyScale` and `fortunaAura` are byte-identical on all 600 rows.
 *
 * PREVIOUSLY RE-RECORDED 2026-08-18 for the item-drop-band refresh (`ITEM_POR_FASE` re-cut by the 2026-08-15
 * patch from 9 bands topping out at item level 90 to 30 running 10…300). Diffed field by field
 * against the previous capture before rewriting, same discipline as every re-record below, and
 * the footprint is exactly the change:
 *
 * - `heroFacts` — **byte-identical, all 5 heroes, every field.** The item level is not an input
 *   to any hero quantity.
 * - `rows` — **only `itemLevels` and `itemLevelLabel` moved**, on 580 of 600 phases. The 20 that
 *   did not are phases 1–20, where both the old and the new first band answer `[10]`. Every
 *   other column, including every throughput column, is byte-identical: `goldPerHour`,
 *   `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`, `stoneChestsPerHour`,
 *   `xpPerHour`, `propsPerHour`, `cyclesPerHour`, `clearSecs`, `expectedHtk`, `mitigationPct`,
 *   `ato`, `gate`, `locked`, `oneShot`, `infeasible`, `gateTimerSecs`, `jaulaEarlyCapPct`,
 *   `jaulaWindowSecs`, `phase`, `heroesOnField`, `concurrencyScale` and `fortunaAura`. That an
 *   unrelated column would have moved is the whole point of the check — the item level is a
 *   display field, and a throughput diff here would have meant something numeric was reading it.
 *
 * In particular this capture sits directly on top of the two XP/stone-chest recaptures below, so
 * it is also the check that the band refresh does not interact with them: `xpPerHour` and
 * `stoneChestsPerHour` carry their post-#128 values here, unmoved by the bands.
 *
 * PREVIOUSLY RE-CAPTURED 2026-08-18, same day as the entry directly below, for the two gaps that entry's
 * own note flagged and deliberately left open: `xpPerHour` here still did not apply the
 * account's `skills.totals.xp_mult`, and the row carried no stone-chest term even though
 * `DROP_RATES` had grown a fifth member for it. Both are `SquadFarmFacts`/`FarmRateRow` additions,
 * not touches to any existing formula input, so the blast radius is narrow by construction:
 *
 * - `rows[].xpPerHour` moved on **all 600 rows**, by exactly the fixture's own `xp_mult` (1.11 on
 *   the committed 5-hero capture) — every row's relative change lands in `[0.10999999999999997,
 *   0.11000000000000022]`, i.e. one constant factor, not a per-row drift. `heroFacts` has zero
 *   diffs: the multiplier is applied once in `buildRow`, downstream of every hero-level term.
 * - `rows[].stoneChestsPerHour` is a **new field**, not a moved one. On the 60 gate rows it is
 *   byte-identical to that row's own `gemsPerHour` (both drop at `DROP_RATES.stone ===
 *   DROP_RATES.gem === 0.00005`); on the 540 non-gate rows it is `0`. Zero mismatches either way.
 * - Every other field — `goldPerHour` included — is byte-identical to the previous capture.
 *   `goldPerHour` in particular does not move: neither change touches the gold multiplier chain
 *   (`teamCoinMult`, `fortunaAura`, `goldSelfMix`), which is exactly what the recorded account-486
 *   gold/hr calibration anchor (a separate fixture from this file's own) requires of any change
 *   that is not itself about gold.
 *
 * Reconciled against a live capture held out of band, not in this repo: the same two witnesses
 * the entry below already cites (phase 51 wiki 167 → game 261, phase 60 wiki 194 → game 303) are
 * `wiki × 1.56`, and a live gate tooltip lists `Stone chest chance` at the same percentage as
 * `Gem chest chance` on the same phase — both confirm the shape fixed here, not just this
 * fixture's own arithmetic.
 *
 * RE-CAPTURED 2026-08-18 for `xpPerProp()` switching from a linear `XP_FASE_INI`→`XP_FASE_FIM`
 * interpolation to the exact per-line `xpProp` integer every wiki phase line already carries (the
 * interpolation is now only a fallback for a phase with no line). This is a pure precision fix —
 * live tooltip witnesses at phase 51 (wiki 167, interpolated 166.7) and phase 60 (wiki 194,
 * interpolated ~193.98) confirmed the exact per-line value is what the game awards.
 *
 * Diffed field by field against the previous capture: **only `rows[].xpPerHour` moved** — 598 of
 * 600 rows (phase 1 and phase 600 are the interpolation's endpoints, so they already matched
 * exactly), max relative change ≈0.644%. `heroFacts` has zero diffs, and every other `rows[]`
 * field (`goldPerHour`, `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`,
 * `propsPerHour`, `cyclesPerHour`, `clearSecs`, `expectedHtk`, `mitigationPct`, `ato`, `gate`,
 * `locked`, `oneShot`, `infeasible`, `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`,
 * `jaulaWindowSecs`, `gateTimerSecs`, `fortunaAura`, `heroesOnField`, `concurrencyScale`, `phase`)
 * is byte-identical — the signature of a change confined to XP and nothing else. Note
 * `xpPerHour` still does not apply the account's `skills.totals.xp_mult` here — that gap is
 * unchanged by this recapture and is tracked separately.
 *
 * RE-RECORDED 2026-08-16 for the flat crit-chance/CDR change (`POINT_GAIN.critChanceFlat` /
 * `.cdrFlat`). The capture is of OUR OWN pre-change output, so re-recording it is the point of
 * the file, not a weakening — what matters is that the movement is explicable. Measured, field
 * by field:
 *
 * - `heroFacts.avgHitBase` — 5 of 5 heroes, ≤1.77%. Crit chance is a smaller share of the
 *   average hit now, so every hero's base hit falls slightly. This is the ONLY heroFacts field
 *   that moved apart from `heroesOnField` (3 rows, ≤3.32%).
 * - `rows.*` — 591 of 600 phases on each throughput column (`goldPerHour`, `chestsPerHour`,
 *   `xpPerHour`, `propsPerHour` ≤10.58%; `keysPerHour`, `cyclesPerHour` ≤10.11%; `clearSecs`
 *   ≤9.18%; `expectedHtk` ≤9.57%), all downstream of the same lower hit. `gemsPerHour` and
 *   `timePiecesPerHour` moved on 59 rows (they are 0 on the rest).
 * - **Unmoved:** every structural column — `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`,
 *   `infeasible`, `itemLevels`, `phase`. The shape of the table is untouched; only magnitudes
 *   downstream of crit moved, which is the signature of a damage change and not a table change.
 *
 * `farm-basis-parity-expected.json` (tests/fixtures/) is a literal capture of the
 * `computeHeroFarmFacts(fixture)` output and the 600-row `computeFarmRates` table, so the
 * assertions below compare the code against frozen literals rather than against itself. Every
 * assertion uses exact `toEqual`, never `toBeCloseTo`, except the one case explicitly documented
 * as approximate (the moved-vector affine claim).
 *
 * RE-CAPTURED at the flat-crit-damage fix (`POINT_GAIN.critDmgFlat`). Diffed field by field
 * against the previous capture first; the footprint is exactly the change and nothing else:
 *
 * - `heroFacts`: **only `avgHitBase`, and only on Bellatrix** (index 4 — the one fixture hero
 *   holding crit-damage points). Her 2 crit-damage points used to read as
 *   `66.252971472748 × (1 + 2 × 0.08)` = 76.853…; flat they read as
 *   `66.252971472748 + 2 × 5` = 76.252971472748, which is what the game's own `stats` block
 *   says. Jon / Perrin / Perrin / Lyra are byte-identical on every field, and so are
 *   `penetrationPct`, `fuseSecs`, `walkSpeedCells`, `cycleSecs`, `plantsPerSec`,
 *   `blocksPerBomb`, `heroLuckPct`, `veiaOuroLevel`, `fortunaLevel`, `uptime` and `degenerate`
 *   on Bellatrix herself — in particular `cycleSecs` did NOT move, which is the proof this
 *   change left the cadence model (below) alone.
 * - `rows`: only the throughput-derived columns moved (`propsPerHour`, `goldPerHour`,
 *   `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`, `xpPerHour`,
 *   `cyclesPerHour`, `clearSecs`, `expectedHtk`). `mitigationPct`, `ato`, `gate`, `locked`,
 *   `oneShot`, `infeasible`, `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`,
 *   `jaulaWindowSecs`, `gateTimerSecs`, `phase`, `fortunaAura`, `heroesOnField` and
 *   `concurrencyScale` are byte-identical — the fix touched one hero's average hit and nothing
 *   else.
 *
 * PREVIOUSLY RE-CAPTURED at the cadence fix (cycle averaged over `HOP_DISTRIBUTION` instead of
 * `max(fuse, E_D_CELLS / w)`). Diffed field by field before rewriting, same as last time:
 *
 * - `heroFacts`: **only `cycleSecs` and `plantsPerSec` moved** — and `plantsPerSec` is `1 /
 *   cycleSecs`, so that is one change, not two. `avgHitBase`, `blocksPerBomb`, `fuseSecs`,
 *   `walkSpeedCells`, `penetrationPct`, `uptime`, `heroLuckPct`, `veiaOuroLevel`,
 *   `fortunaLevel` and `degenerate` are byte-identical. Notably `uptime` did NOT move, which is
 *   the proof that this change touched cadence and left the House model alone.
 * - `rows`: only throughput-derived columns moved. `locked`, `mitigationPct`, `oneShot`,
 *   `infeasible`, `concurrencyScale`, `fortunaAura`, `ato`, `gate`, `gateTimerSecs`,
 *   `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct` and `jaulaWindowSecs` are byte-identical.
 *
 * A warning for the next person to re-record this: the table below is captured with
 * `computeFarmRates({ heroes, account })` and NO `maxPhase`. Passing one flips `locked` on every
 * row, which looks like a real regression in the diff and is purely a harness mistake.
 *
 * PREVIOUSLY RE-CAPTURED at the House-recovery-slot / `casa.cycle_secs` / `field_slots` fix,
 * with the same discipline. That diff was:
 *
 * - `heroFacts`: **only `uptime` moved.** `avgHitBase`, `penetrationPct`, `fuseSecs`,
 *   `walkSpeedCells`, `cycleSecs`, `plantsPerSec`, `blocksPerBomb`, `heroLuckPct`,
 *   `veiaOuroLevel`, `fortunaLevel` and `degenerate` are byte-identical to the pre-fix capture.
 *   `uptime` moved because the fixture's rest seconds now come from its own `casa.cycle_secs`
 *   (1181.05s) rather than the `HOUSES` table's interpolation (1102s) — a longer House cycle,
 *   so every duty cycle is lower. Nothing about the damage or cadence math changed, and this
 *   file's untouched columns are the proof.
 * - `rows`: only the throughput-derived columns moved (`propsPerHour`, `goldPerHour`,
 *   `chestsPerHour`, `keysPerHour`, `gemsPerHour`, `timePiecesPerHour`, `xpPerHour`,
 *   `cyclesPerHour`, `clearSecs`, `expectedHtk`), plus the two new ones (`heroesOnField`,
 *   `concurrencyScale`). `mitigationPct`, `ato`, `gate`, `locked`, `oneShot`, `infeasible`,
 *   `itemLevels`, `itemLevelLabel`, `jaulaEarlyCapPct`, `jaulaWindowSecs` and `gateTimerSecs`
 *   are byte-identical — i.e. the fix touched throughput and nothing else.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import {
  computeHeroFarmBases,
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  squadFactsFromBases,
  heroFactsFromBasis,
  computeFarmRates,
  farmPricedAccount,
  farmTeamBuffs,
  type HeroFarmFacts,
  type FarmRateRow,
} from '@bombfarm/domain/farm-rate';
import { pipelineForHero } from '@bombfarm/domain/roster-dps';
import {
  energySwitchPointCallCount,
  resetEnergySwitchPointCallCount,
} from '@bombfarm/domain/advisor-pipeline';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();

const expected = JSON.parse(
  readFileSync(join(__dirname, 'fixtures', 'farm-basis-parity-expected.json'), 'utf8'),
) as { heroFacts: HeroFarmFacts[]; rows: FarmRateRow[] };

/** Relative-error check for the one approximate assertion in this file (the affine claim). */
function expectCloseRel(actual: number, expectedValue: number, relTol: number): void {
  if (expectedValue === 0) {
    expect(Math.abs(actual)).toBeLessThanOrEqual(relTol);
    return;
  }
  const relError = Math.abs(actual - expectedValue) / Math.abs(expectedValue);
  expect(relError, `actual=${actual} expected=${expectedValue} relError=${relError}`).toBeLessThanOrEqual(relTol);
}

describe('capture-then-compare — the refactor reproduces the pre-refactor output exactly', () => {
  it('computeHeroFarmFacts(fixture) toEquals the frozen pre-refactor capture, all 5 heroes', () => {
    const facts = computeHeroFarmFacts({ heroes, account });
    expect(facts).toEqual(expected.heroFacts);
  });

  it('the full 600-row computeFarmRates table toEquals the frozen pre-refactor capture', () => {
    const { rows } = computeFarmRates({ heroes, account });
    expect(rows).toEqual(expected.rows);
  });
});

describe('heroFactsFromBasis(b, b.pts) — identity with computeHeroFarmFacts, every field', () => {
  it('matches the corresponding computeHeroFarmFacts entry for every fixture hero', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const facts = computeHeroFarmFacts({ heroes, account });
    expect(bases).toHaveLength(facts.length);

    for (let i = 0; i < bases.length; i++) {
      const reconstructed = heroFactsFromBasis(bases[i], bases[i].pts);
      expect(reconstructed).toEqual(facts[i]);
    }
  });

  it('does NOT short-circuit on pts === basis.pts (same object identity still goes through the full reconstruction)', () => {
    const [basis] = computeHeroFarmBases({ heroes, account });
    const [fact] = computeHeroFarmFacts({ heroes: [heroes[0]], account });
    // Passing the exact same object reference as `basis.pts` — a short-circuit implementation
    // would still need to produce the identical result, so this alone does not distinguish the
    // two; it is asserted together with the capture-then-compare suite above, which would catch
    // a short-circuit that returns a stale/frozen shape instead of truly recomputing.
    expect(heroFactsFromBasis(basis, basis.pts)).toEqual(fact);
  });
});

describe('uptime — the §2.1 trap, asserted directly', () => {
  it('facts.uptime === pipeline.uptime / 100 exactly, for every fixture hero', () => {
    const facts = computeHeroFarmFacts({ heroes, account });
    for (const fact of facts) {
      const hero = heroes.find((h) => h.id === fact.heroId)!;
      // The account farm-rate ACTUALLY prices against — team auras weighted over the rotation,
      // not `account.teamBuffs`. Handing the pipeline the raw account here would compare two
      // different accounts and read the (correct) difference as a §2.1 parity break.
      const pipeline = pipelineForHero(hero, farmPricedAccount({ heroes, account }), 1, 0);
      expect(fact.uptime).toBe(pipeline.uptime / 100);
    }
  });
});

describe('the moved-vector case — the affine claim itself', () => {
  it('heroFactsFromBasis at a moved vector matches a full pipelineForHero re-run on a HeroRecord carrying that vector, to 1e-9 relative', () => {
    const jon = heroes.find((h) => h.name === 'Jon')!;
    const [jonBasis] = computeHeroFarmBases({ heroes: [jon], account });
    const movedPts = { ...jonBasis.pts, attack: jonBasis.pts.attack - 5, energy: jonBasis.pts.energy + 5 };

    const reconstructed = heroFactsFromBasis(jonBasis, movedPts);

    // The re-run must price the SAME team auras the basis was built with, pinned via the override
    // path. Left to re-derive them it would not: rotation-weighted auras are a function of every
    // hero's uptime, moving 5 points from attack into energy moves this hero's uptime, and the
    // affine claim under test is about the point vector alone — it holds the whole pipeline-
    // derived context fixed, auras included (see `heroFactsFromBasis`'s own note). Comparing
    // against a re-priced run would test the aura feedback loop, not the reconstruction.
    const pinned = { ...account, teamBuffs: farmTeamBuffs({ heroes: [jon], account }), teamBuffsOverride: {} };
    const movedHero: HeroRecord = { ...jon, pts: movedPts };
    const [realRun] = computeHeroFarmFacts({ heroes: [movedHero], account: pinned });

    expectCloseRel(reconstructed.avgHitBase, realRun.avgHitBase, 1e-9);
    expectCloseRel(reconstructed.penetrationPct, realRun.penetrationPct, 1e-9);
    expectCloseRel(reconstructed.fuseSecs, realRun.fuseSecs, 1e-9);
    expectCloseRel(reconstructed.walkSpeedCells, realRun.walkSpeedCells, 1e-9);
    expectCloseRel(reconstructed.cycleSecs, realRun.cycleSecs, 1e-9);
    expectCloseRel(reconstructed.plantsPerSec, realRun.plantsPerSec, 1e-9);
    expectCloseRel(reconstructed.blocksPerBomb, realRun.blocksPerBomb, 1e-9);
    expectCloseRel(reconstructed.uptime, realRun.uptime, 1e-9);
    expectCloseRel(reconstructed.heroLuckPct, realRun.heroLuckPct, 1e-9);
    expect(reconstructed.veiaOuroLevel).toBe(realRun.veiaOuroLevel);
    expect(reconstructed.fortunaLevel).toBe(realRun.fortunaLevel);
    expect(reconstructed.degenerate).toBe(realRun.degenerate);
  });
});

describe('squadFactsFromBases — identity with computeSquadFarmFacts(computeHeroFarmFacts(...))', () => {
  it('squadFactsFromBases(bases, null, account) toEquals computeSquadFarmFacts(computeHeroFarmFacts(input), account)', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    const viaBases = squadFactsFromBases(bases, null, account);
    const viaFacts = computeSquadFarmFacts(computeHeroFarmFacts({ heroes, account }), account);
    expect(viaBases).toEqual(viaFacts);
  });
});

describe('pipeline-call count — the basis is extracted once and never re-derived', () => {
  beforeEach(() => {
    resetEnergySwitchPointCallCount();
  });

  it('computeHeroFarmBases costs 2x|enabled| (rotation-priced auras); 200 subsequent heroFactsFromBasis calls cost 0', () => {
    const bases = computeHeroFarmBases({ heroes, account });
    expect(energySwitchPointCallCount).toBe(2 * heroes.length);

    resetEnergySwitchPointCallCount();
    for (let i = 0; i < 200; i++) {
      for (const basis of bases) {
        heroFactsFromBasis(basis, basis.pts);
      }
    }
    expect(energySwitchPointCallCount).toBe(0);
  });
});
