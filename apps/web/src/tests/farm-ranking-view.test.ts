import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import * as phasesStrings from '@/shared/i18n/namespaces/phases';
import {
  applyFarmFilters,
  DEFAULT_SORT,
  defaultFarmFilters,
  FARM_COLUMNS,
  sortFarmRows,
  type FarmSortKey,
} from '@/features/phases/model/farm-ranking-view';
import { WEB_PACKAGE_ROOT } from './helpers/web-package-root';

function row(overrides: Partial<FarmRateRow> & { phase: number }): FarmRateRow {
  return {
    ato: 1,
    gate: false,
    locked: false,
    mitigationPct: 0,
    goldPerHour: 0,
    chestsPerHour: 0,
    keysPerHour: 0,
    gemsPerHour: 0,
    timePiecesPerHour: 0,
    stoneChestsPerHour: 0,
    xpPerHour: 0,
    propsPerHour: 0,
    cyclesPerHour: 0,
    clearSecs: 60,
    gateTimerSecs: null,
    oneShot: false,
    infeasible: false,
    itemLevels: [],
    itemLevelLabel: '',
    jaulaEarlyCapPct: 0,
    jaulaWindowSecs: 0,
    expectedHtk: 1,
    heroesOnField: 1,
    concurrencyScale: 1,
    fortunaAura: 0,
    ...overrides,
  };
}

describe('FARM_COLUMNS (matches the design column list, transcribed, not derived from the code)', () => {
  // Transcribed from the PRD: "phase coordinate + flavour name, gate and lock badges,
  // mitigation %, gold/hr, item-chests/hr, keys/hr (signed), gems/hr, time-pieces/hr, XP/hr,
  // item-level band, estimated map clear time, the team one-shots-all-props indicator, the
  // jaula early-arrival cap % and guaranteed window, and the infeasibility flag."
  const expectedIds = [
    'phase',
    'mitigation',
    'gold',
    'chests',
    'keys',
    'gems',
    'timePieces',
    'xp',
    'itemLevel',
    'clearTime',
    'oneShot',
    'jaula',
    'infeasible',
  ];

  it('declares exactly the PRD column set, in order', () => {
    expect(FARM_COLUMNS.map((column) => column.id)).toEqual(expectedIds);
  });

  it('every rate column (mitigation, gold, chests, keys, gems, timePieces, xp, clearTime) is sortable', () => {
    const rateIds = ['mitigation', 'gold', 'chests', 'keys', 'gems', 'timePieces', 'xp', 'clearTime'];
    for (const id of rateIds) {
      const column = FARM_COLUMNS.find((candidate) => candidate.id === id)!;
      expect(column.sortKey, `${id} should be sortable`).not.toBeNull();
    }
  });

  it('badge/flag/label columns (phase, itemLevel, oneShot, jaula, infeasible) are not sortable', () => {
    for (const id of ['phase', 'itemLevel', 'oneShot', 'jaula', 'infeasible']) {
      const column = FARM_COLUMNS.find((candidate) => candidate.id === id)!;
      expect(column.sortKey).toBeNull();
    }
  });

  it('every column header key resolves in both EN and PT strings', () => {
    const en = phasesStrings.en as Record<string, string>;
    const pt = phasesStrings.pt as Record<string, string>;
    for (const column of FARM_COLUMNS) {
      expect(en[column.headerKey], `en.${column.headerKey}`).toBeTruthy();
      expect(pt[column.headerKey], `pt.${column.headerKey}`).toBeTruthy();
    }
  });
});

describe('DEFAULT_SORT', () => {
  it('is gold/hr descending', () => {
    expect(DEFAULT_SORT).toEqual({ key: 'goldPerHour', direction: 'desc' });
  });
});

describe('sortFarmRows', () => {
  const rows = [
    row({ phase: 1, goldPerHour: 100, mitigationPct: 5, chestsPerHour: 1, keysPerHour: -2, gemsPerHour: 3, timePiecesPerHour: 4, xpPerHour: 5, clearSecs: 30 }),
    row({ phase: 2, goldPerHour: 300, mitigationPct: 1, chestsPerHour: 3, keysPerHour: 2, gemsPerHour: 1, timePiecesPerHour: 2, xpPerHour: 1, clearSecs: 10 }),
    row({ phase: 3, goldPerHour: 200, mitigationPct: 3, chestsPerHour: 2, keysPerHour: 0, gemsPerHour: 2, timePiecesPerHour: 3, xpPerHour: 3, clearSecs: 20 }),
  ];

  const cases: { key: FarmSortKey; asc: number[]; desc: number[] }[] = [
    { key: 'mitigationPct', asc: [2, 3, 1], desc: [1, 3, 2] },
    { key: 'goldPerHour', asc: [1, 3, 2], desc: [2, 3, 1] },
    { key: 'chestsPerHour', asc: [1, 3, 2], desc: [2, 3, 1] },
    { key: 'keysPerHour', asc: [1, 3, 2], desc: [2, 3, 1] },
    { key: 'gemsPerHour', asc: [2, 3, 1], desc: [1, 3, 2] },
    { key: 'timePiecesPerHour', asc: [2, 3, 1], desc: [1, 3, 2] },
    { key: 'xpPerHour', asc: [2, 3, 1], desc: [1, 3, 2] },
    { key: 'clearSecs', asc: [2, 3, 1], desc: [1, 3, 2] },
  ];

  for (const { key, asc, desc } of cases) {
    it(`sorts by ${key} ascending`, () => {
      expect(sortFarmRows(rows, key, 'asc').map((entry) => entry.phase)).toEqual(asc);
    });
    it(`sorts by ${key} descending`, () => {
      expect(sortFarmRows(rows, key, 'desc').map((entry) => entry.phase)).toEqual(desc);
    });
  }

  it('breaks ties deterministically by ascending phase', () => {
    const tied = [
      row({ phase: 5, goldPerHour: 100 }),
      row({ phase: 2, goldPerHour: 100 }),
      row({ phase: 8, goldPerHour: 100 }),
    ];
    expect(sortFarmRows(tied, 'goldPerHour', 'desc').map((entry) => entry.phase)).toEqual([2, 5, 8]);
    expect(sortFarmRows(tied, 'goldPerHour', 'asc').map((entry) => entry.phase)).toEqual([2, 5, 8]);
  });

  it('0 gem/time values on non-gate rows sort consistently (no NaN, stable order)', () => {
    const nonGate = [row({ phase: 1, gemsPerHour: 0 }), row({ phase: 2, gemsPerHour: 0 })];
    expect(sortFarmRows(nonGate, 'gemsPerHour', 'desc').map((entry) => entry.phase)).toEqual([1, 2]);
  });

  it('Infinity clearSecs sorts to the slow end regardless of direction', () => {
    const rowsWithInfinite = [
      row({ phase: 1, clearSecs: 10 }),
      row({ phase: 2, clearSecs: Infinity }),
      row({ phase: 3, clearSecs: 5 }),
    ];
    expect(sortFarmRows(rowsWithInfinite, 'clearSecs', 'asc').map((entry) => entry.phase)).toEqual([3, 1, 2]);
    // "Regardless of direction" means Infinity never moves to the top just because the user
    // flipped the sort — it stays last (worst) whichever way the finite values are ordered.
    expect(sortFarmRows(rowsWithInfinite, 'clearSecs', 'desc').map((entry) => entry.phase)).toEqual([1, 3, 2]);
  });

  it('infeasible rows keep their natural sort position — never pinned or reordered', () => {
    const mixed = [
      row({ phase: 1, goldPerHour: 300, infeasible: false }),
      row({ phase: 2, goldPerHour: 200, infeasible: true }),
      row({ phase: 3, goldPerHour: 100, infeasible: false }),
    ];
    expect(sortFarmRows(mixed, 'goldPerHour', 'desc').map((entry) => entry.phase)).toEqual([1, 2, 3]);
  });
});

describe('applyFarmFilters', () => {
  const rows = [
    row({ phase: 1, ato: 1, gate: false, locked: false, infeasible: false }),
    row({ phase: 2, ato: 1, gate: true, locked: false, infeasible: false }),
    row({ phase: 3, ato: 2, gate: false, locked: true, infeasible: false }),
    row({ phase: 4, ato: 2, gate: false, locked: false, infeasible: true }),
  ];

  it('defaultFarmFilters() is unlocked-only on, no ato, gate all, feasible-only off', () => {
    expect(defaultFarmFilters()).toEqual({
      unlockedOnly: true,
      ato: null,
      gate: 'all',
      feasibleOnly: false,
    });
  });

  it('unlockedOnly excludes locked rows when some rows are locked', () => {
    const result = applyFarmFilters(rows, { ...defaultFarmFilters() });
    expect(result.map((entry) => entry.phase)).toEqual([1, 2, 4]);
  });

  it('unlockedOnly is a no-op when every row is locked:false (the maxPhase:null compute result)', () => {
    const allUnlocked = rows.map((entry) => ({ ...entry, locked: false }));
    const result = applyFarmFilters(allUnlocked, { ...defaultFarmFilters(), unlockedOnly: true });
    expect(result).toHaveLength(4);
  });

  it('ato filters to a single difficulty band', () => {
    const result = applyFarmFilters(rows, { ...defaultFarmFilters(), unlockedOnly: false, ato: 2 });
    expect(result.map((entry) => entry.phase)).toEqual([3, 4]);
  });

  it('gate filters to gate-only rows', () => {
    const result = applyFarmFilters(rows, { ...defaultFarmFilters(), unlockedOnly: false, gate: 'gate' });
    expect(result.map((entry) => entry.phase)).toEqual([2]);
  });

  it('gate filters to non-gate-only rows', () => {
    const result = applyFarmFilters(rows, {
      ...defaultFarmFilters(),
      unlockedOnly: false,
      gate: 'non-gate',
    });
    expect(result.map((entry) => entry.phase)).toEqual([1, 3, 4]);
  });

  it('feasibleOnly excludes infeasible rows', () => {
    const result = applyFarmFilters(rows, {
      ...defaultFarmFilters(),
      unlockedOnly: false,
      feasibleOnly: true,
    });
    expect(result.map((entry) => entry.phase)).toEqual([1, 2, 3]);
  });

  it('combined filters narrow further', () => {
    const result = applyFarmFilters(rows, {
      unlockedOnly: false,
      ato: 2,
      gate: 'non-gate',
      feasibleOnly: true,
    });
    expect(result.map((entry) => entry.phase)).toEqual([3]);
  });

  it('a combination matching zero rows returns an empty array', () => {
    const result = applyFarmFilters(rows, { unlockedOnly: false, ato: 5, gate: 'all', feasibleOnly: false });
    expect(result).toEqual([]);
  });
});

describe('React-free source (both files)', () => {
  it('farm-ranking-view.ts has no React import', () => {
    const source = readFileSync(
      `${WEB_PACKAGE_ROOT}/src/features/phases/model/farm-ranking-view.ts`,
      'utf8',
    );
    expect(source).not.toMatch(/from ['"]react['"]/);
  });
});
