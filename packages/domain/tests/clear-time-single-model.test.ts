/**
 * One clear-time model, and the retired one it must never quietly become.
 *
 * The retired estimator divided the map's total HP by the roster's summed DPS — a fluid that
 * ignores that props die one at a time, that a hit's overshoot is wasted, that the crit is rolled
 * per hit and that the field starves under ten props. The shipped row prices all of that
 * (`model/clear-time.ts`, ADR-017). The two must not agree: on a map a squad clears in tens of
 * seconds they sit a clear margin apart, in whichever direction the roster's hit size puts them.
 */
import { describe, expect, it } from 'vitest';
import { computeFarmRates } from '@bombfarm/domain/farm-rate';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { rankRosterByDps, sumTopDps } from '@bombfarm/domain/roster-dps';
import { DEFAULT_CASA_SLOTS } from '@bombfarm/domain/casa-slots';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const FIXTURE = 'save-20260818-12heroes.json';
const PHASE = 51;

function ratioAt(phase: number): number {
  const { heroes, account } = loadFarmRateFixture(FIXTURE, 'sheet-math');
  const { rows } = computeFarmRates({ heroes, account });
  const row = rows.find((entry) => entry.phase === phase);
  const intel = computePhaseIntelGlobal(phase, {});
  if (!row || !intel) throw new Error(`no row/intel for phase ${phase}`);
  const squadSlots = account.fieldSlots ?? account.slots ?? DEFAULT_CASA_SLOTS;
  const top = rankRosterByDps({ heroes, account, phase, mitigationPct: intel.mitigationPct }, squadSlots);
  return row.clearSecs / (intel.totalMapHp / sumTopDps(top));
}

describe('clear time — one model, and the retired one it replaced', () => {
  it('the shipped clear is not a multiple of the fluid-HP figure: the two diverge across phases', () => {
    // A fluid clear shrinks to nothing as the props' HP does; the shipped one is bounded below by
    // the cadence of reaching and bombing them, so the ratio between the two is large on a map
    // the roster one-shots and falls toward one where every hit is needed.
    const trivial = ratioAt(5);
    const deep = ratioAt(151);
    expect(Number.isFinite(trivial)).toBe(true);
    expect(Number.isFinite(deep)).toBe(true);
    expect(trivial).toBeGreaterThan(deep * 1.5);
    expect(ratioAt(PHASE)).toBeGreaterThan(deep);
  });
});
