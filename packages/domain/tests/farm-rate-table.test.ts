/**
 * The row and table functions.
 *
 * Table shape (600 rows, ascending, purity, finite sweep, gate/non-gate column rules, the
 * leaf-helper cross-check against `computePhaseIntelGlobal`, the jaula-window constancy, and
 * out-of-range → `null`). Hand-derived per-field values live in `farm-rate-hand-values.test.ts`
 * (T7); this file proves shape and structure, not magnitude.
 */
import { describe, expect, it } from 'vitest';
import {
  computeHeroFarmFacts,
  computeSquadFarmFacts,
  computeFarmRateRow,
  computeFarmRateTable,
  type ReturnBonusMode,
} from '@bombfarm/domain/farm-rate';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { JAULA, WIKI_PHASE_LINES } from '@bombfarm/domain/phase-wiki';
import { loadFarmRateFixture } from './helpers/farm-rate-fixtures';

const { heroes, account } = loadFarmRateFixture();
const heroFacts = computeHeroFarmFacts({ heroes, account });
const squad = computeSquadFarmFacts(heroFacts, account);

describe('computeFarmRateTable — 600 rows, ascending, every field present (spec.md P1-1 AC-1)', () => {
  it('returns exactly 600 rows in ascending phase order', () => {
    const rows = computeFarmRateTable(squad);
    expect(rows).toHaveLength(600);
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].phase).toBe(i + 1);
    }
  });

  it('never produces a null row (iterates WIKI_PHASE_LINES directly)', () => {
    const rows = computeFarmRateTable(squad);
    expect(rows.every((row) => row != null)).toBe(true);
  });
});

describe('computeFarmRateTable — non-gate vs gate column rules (spec.md P1-1 AC-2/AC-3)', () => {
  it('non-gate phase 42: gemsPerHour/timePiecesPerHour === 0, keysPerHour >= 0, gateTimerSecs null', () => {
    const rows = computeFarmRateTable(squad);
    const row = rows.find((r) => r.phase === 42)!;
    expect(row.gate).toBe(false);
    expect(row.gemsPerHour).toBe(0);
    expect(row.timePiecesPerHour).toBe(0);
    expect(row.keysPerHour).toBeGreaterThanOrEqual(0);
    expect(row.gateTimerSecs).toBeNull();
  });

  it('gate phase 10: keysPerHour <= 0 and equals -(cyclesPerHour × KEY_GATE_COST), gems/time > 0, gateTimerSecs is the ato timer', () => {
    const rows = computeFarmRateTable(squad);
    const row = rows.find((r) => r.phase === 10)!;
    expect(row.gate).toBe(true);
    expect(row.keysPerHour).toBeLessThanOrEqual(0);
    expect(row.gemsPerHour).toBeGreaterThan(0);
    expect(row.timePiecesPerHour).toBeGreaterThan(0);
    expect(row.gateTimerSecs).not.toBeNull();
    expect(row.gateTimerSecs).toBe(600);
  });
});

describe('computeFarmRateTable — finite sweep across all three return-bonus modes (spec.md P1-1 AC-4)', () => {
  const modes: ReturnBonusMode[] = ['off', 'on', 'vip'];

  it('every rate is a finite number; only clearSecs may be Infinity, and only when infeasible', () => {
    for (const mode of modes) {
      const rows = computeFarmRateTable(squad, { returnBonus: mode });
      for (const row of rows) {
        expect(Number.isNaN(row.goldPerHour)).toBe(false);
        expect(Number.isNaN(row.chestsPerHour)).toBe(false);
        expect(Number.isNaN(row.keysPerHour)).toBe(false);
        expect(Number.isNaN(row.gemsPerHour)).toBe(false);
        expect(Number.isNaN(row.timePiecesPerHour)).toBe(false);
        expect(Number.isNaN(row.xpPerHour)).toBe(false);
        expect(Number.isNaN(row.propsPerHour)).toBe(false);
        expect(Number.isNaN(row.cyclesPerHour)).toBe(false);
        expect(Number.isNaN(row.expectedHtk)).toBe(false);
        expect(Number.isFinite(row.goldPerHour)).toBe(true);
        expect(Number.isFinite(row.chestsPerHour)).toBe(true);
        expect(Number.isFinite(row.keysPerHour)).toBe(true);
        expect(Number.isFinite(row.gemsPerHour)).toBe(true);
        expect(Number.isFinite(row.timePiecesPerHour)).toBe(true);
        expect(Number.isFinite(row.xpPerHour)).toBe(true);
        expect(Number.isFinite(row.propsPerHour)).toBe(true);
        expect(Number.isFinite(row.cyclesPerHour)).toBe(true);

        if (!Number.isFinite(row.clearSecs)) {
          expect(row.infeasible).toBe(true);
        }
      }
    }
  });
});

describe('computeFarmRateTable — purity', () => {
  it('two calls with the same squad/options are deep-equal', () => {
    const rowsA = computeFarmRateTable(squad, { returnBonus: 'on' });
    const rowsB = computeFarmRateTable(squad, { returnBonus: 'on' });
    expect(rowsA).toEqual(rowsB);
  });
});

describe('computeFarmRateTable — leaf helpers agree with computePhaseIntelGlobal (design.md §2.4)', () => {
  it('mitigationPct, itemLevelLabel, jaulaEarlyCapPct, jaulaWindowSecs match on a 12-phase sample', () => {
    const samplePhases = [1, 10, 42, 50, 100, 150, 200, 250, 300, 400, 500, 600];
    const rows = computeFarmRateTable(squad);
    for (const phase of samplePhases) {
      const row = rows.find((r) => r.phase === phase)!;
      const globalIntel = computePhaseIntelGlobal(phase, account.tree.teamCoinPct ?? 0)!;
      expect(row.mitigationPct).toBeCloseTo(globalIntel.mitigationPct, 9);
      expect(row.itemLevelLabel).toBe(globalIntel.itemLevelLabel);
      expect(row.jaulaEarlyCapPct).toBeCloseTo(globalIntel.jaulaEarlyCapPct, 9);
      expect(row.jaulaWindowSecs).toBe(globalIntel.jaulaWindowSecs);
    }
  });
});

describe('computeFarmRateTable — jaula window is constant across every row (design.md §2.4.1)', () => {
  it('jaulaWindowSecs is identical for all 600 rows and equals JAULA.janelaSecs — never JAULA.janelaSecsVip', () => {
    const rows = computeFarmRateTable(squad);
    for (const row of rows) {
      expect(row.jaulaWindowSecs).toBe(JAULA.janelaSecs);
    }
  });

  it('jaulaWindowSecs is unchanged by returnBonus: "vip" (the VIP jaula window is not modeled)', () => {
    const offRows = computeFarmRateTable(squad, { returnBonus: 'off' });
    const vipRows = computeFarmRateTable(squad, { returnBonus: 'vip' });
    for (let i = 0; i < offRows.length; i++) {
      expect(vipRows[i].jaulaWindowSecs).toBe(offRows[i].jaulaWindowSecs);
    }
  });
});

describe('computeFarmRateRow — out-of-range phase returns null, never clamps (spec.md P1-5 AC-5)', () => {
  it.each([0, 601, -1, NaN, 42.5])('phase %p ⇒ null', (phase) => {
    expect(computeFarmRateRow(phase, squad)).toBeNull();
  });

  it('a valid boundary phase (1 and WIKI_PHASE_LINES.length) is NOT null', () => {
    expect(computeFarmRateRow(1, squad)).not.toBeNull();
    expect(computeFarmRateRow(WIKI_PHASE_LINES.length, squad)).not.toBeNull();
  });
});
