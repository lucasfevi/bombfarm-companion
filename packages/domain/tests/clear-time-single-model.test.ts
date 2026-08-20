/**
 * Why the app has ONE clear-time model, and why the obvious second one is wrong.
 *
 * The Phases explorer's squad panel used to print its own estimate — total map HP divided by the
 * squad's summed sustained DPS — beside the ranking board's `FarmRateRow.clearSecs` for the same
 * phase, on the same page. The two never agreed, because dividing a fluid HP pool by DPS credits
 * every point of damage to prop HP, and the game does not: a prop dies on the hit that takes it
 * below zero and the excess is discarded. `farm-rate.ts` charges for that with
 * `eHtk = Σ share × ceil(propHp / avgHit)`.
 *
 * The gap is ENTIRELY that quantization, not the House/field ceilings — on this fixture at phase
 * 51 the House throttle is a factor of 0.990, while the top hero needs 0.89 fractional hits for
 * the average prop against an `eHtk` of 1.40, and `1.40 / 0.89` is the whole discrepancy.
 *
 * `farm-rate-phase51-ato2-anchor.test.ts` pins `clearSecs` on this same fixture and phase against
 * a real measurement; it is the reason the direction below is an assertion about which model is
 * right rather than a note about two models differing. That constant is deliberately NOT repeated
 * here — this file asserts the RATIO and the SIGN, so the two files cannot drift into disagreeing
 * about the measurement itself.
 */
import { describe, expect, it } from 'vitest';
import { computeFarmRates } from '@bombfarm/domain/farm-rate';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { rankRosterByDps, sumTopDps } from '@bombfarm/domain/roster-dps';
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const FIXTURE = 'save-20260818-12heroes.json';
const PHASE = 51;

function models() {
  const { heroes, account } = loadFarmRateFixture(FIXTURE, 'sheet-math');
  const { rows } = computeFarmRates({ heroes, account });
  const row = rows.find((entry) => entry.phase === PHASE);
  const intel = computePhaseIntelGlobal(PHASE, {});
  if (!row || !intel) throw new Error(`no row/intel for phase ${PHASE}`);

  const squadSlots = account.fieldSlots ?? account.slots ?? DEFAULT_CASA_SLOTS;
  const top = rankRosterByDps(
    { heroes, account, phase: PHASE, mitigationPct: intel.mitigationPct },
    squadSlots,
  );
  return { shipped: row.clearSecs, fluidHp: intel.totalMapHp / sumTopDps(top) };
}

describe('clear time — one model, and the retired one it replaced', () => {
  it('the fluid-HP model reads far fast against the quantized one', () => {
    const { shipped, fluidHp } = models();
    expect(fluidHp).toBeLessThan(shipped);
    expect(shipped / fluidHp).toBeGreaterThan(1.4);
  });

  it('the gap is large enough that no rounding or formatting could hide it', () => {
    const { shipped, fluidHp } = models();
    expect(shipped - fluidHp).toBeGreaterThan(20);
  });
});
