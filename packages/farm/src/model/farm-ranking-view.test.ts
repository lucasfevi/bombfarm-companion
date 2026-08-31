import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { FarmRateRow } from '@bombfarm/domain/farm-rate';
import { FIELD_SLOTS_MAX } from '@bombfarm/domain/casa-slots';
import { farmEn, farmPtBR } from '../copy';
import {
  applyFarmFilters,
  DEFAULT_SORT,
  defaultFarmFilters,
  FARM_COLUMNS,
  pickBestFarmRow,
  pickContentionNotice,
  CONTENTION_NOTICE_MIN_PCT,
  sortFarmRows,
  type FarmSortKey,
} from './farm-ranking-view';

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
    fieldContentionPct: 0,
    concurrencyScale: 1,
    fortunaAura: 0,
    ...overrides,
  };
}

describe('FARM_COLUMNS (matches the design column list, transcribed, not derived from the code)', () => {
  // Transcribed from the PRD: "phase coordinate + flavour name, gate and lock badges,
  // mitigation %, gold/hr, item-chests/hr, keys/hr (signed), gems/hr, time-pieces/hr, XP/hr,
  // item-level band, estimated map clear time, the team one-shots-all-props indicator, and the
  // infeasibility flag." The board's fourth pass (2026-08-19) removed the cage-window column —
  // the jaula early-arrival cap %/window are still `@bombfarm/domain` fields, just no longer
  // rendered here (they remain on the Phase explorer's own Cage panel).
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

  it('badge/flag/label columns (phase, itemLevel, oneShot) are not sortable', () => {
    for (const id of ['phase', 'itemLevel', 'oneShot']) {
      const column = FARM_COLUMNS.find((candidate) => candidate.id === id)!;
      expect(column.sortKey).toBeNull();
    }
  });

  it('every column header key resolves in both EN and PT strings', () => {
    const en = farmEn as Record<string, string>;
    const pt = farmPtBR as Record<string, string>;
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

  it('defaultFarmFilters() is unlocked-only on, no ato, gate all, no item-level floor', () => {
    expect(defaultFarmFilters()).toEqual({
      unlockedOnly: true,
      ato: null,
      gate: 'all',
      minItemLevel: null,
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

  it('combined filters narrow further', () => {
    // row 4 (ato 2, non-gate) is the only row that is both unlockedOnly-eligible (locked:
    // false — row 3 shares its ato/gate but is excluded by unlockedOnly instead, being locked).
    const result = applyFarmFilters(rows, {
      unlockedOnly: true,
      ato: 2,
      gate: 'non-gate',
      minItemLevel: null,
    });
    expect(result.map((entry) => entry.phase)).toEqual([4]);
  });

  it('a combination matching zero rows returns an empty array', () => {
    const result = applyFarmFilters(rows, {
      unlockedOnly: false,
      ato: 5,
      gate: 'all',
      minItemLevel: null,
    });
    expect(result).toEqual([]);
  });
});

describe('applyFarmFilters — minItemLevel (the floor is the LOWEST band, not the highest)', () => {
  // Bands overlap by ten phases, so a row can carry two tiers; `itemLevels` is what
  // `@bombfarm/domain` resolved for the phase, ascending. The filter answers "every item this
  // phase drops is at least level N", so an overlap row is judged on its LOWER tier — that is
  // the level it can still hand back.
  const rows = [
    row({ phase: 25, itemLevels: [10, 20] }),
    row({ phase: 45, itemLevels: [20, 30] }),
    row({ phase: 100, itemLevels: [50] }),
  ];

  it('null keeps every row', () => {
    const result = applyFarmFilters(rows, { ...defaultFarmFilters(), minItemLevel: null });
    expect(result.map((entry) => entry.phase)).toEqual([25, 45, 100]);
  });

  it('keeps only rows whose lowest band is at or above the floor', () => {
    const result = applyFarmFilters(rows, { ...defaultFarmFilters(), minItemLevel: 20 });
    expect(result.map((entry) => entry.phase)).toEqual([45, 100]);
  });

  it('excludes an overlap row on its LOWER tier even though its upper tier clears the floor', () => {
    const result = applyFarmFilters([row({ phase: 45, itemLevels: [20, 30] })], {
      ...defaultFarmFilters(),
      minItemLevel: 30,
    });
    expect(result).toEqual([]);
  });

  it('keeps a single-tier row sitting exactly on the floor', () => {
    const result = applyFarmFilters([row({ phase: 55, itemLevels: [30] })], {
      ...defaultFarmFilters(),
      minItemLevel: 30,
    });
    expect(result.map((entry) => entry.phase)).toEqual([55]);
  });

  it('excludes a row whose only band sits below the floor', () => {
    const result = applyFarmFilters([row({ phase: 5, itemLevels: [10] })], {
      ...defaultFarmFilters(),
      minItemLevel: 20,
    });
    expect(result).toEqual([]);
  });

  it('excludes a row with no known bands — it guarantees nothing', () => {
    const result = applyFarmFilters([row({ phase: 5, itemLevels: [] })], {
      ...defaultFarmFilters(),
      minItemLevel: 10,
    });
    expect(result).toEqual([]);
  });

  it('narrows alongside the other filters', () => {
    const mixed = [
      row({ phase: 55, ato: 1, gate: true, itemLevels: [30] }),
      row({ phase: 56, ato: 1, gate: false, itemLevels: [30] }),
      row({ phase: 45, ato: 1, gate: false, itemLevels: [20, 30] }),
    ];
    const result = applyFarmFilters(mixed, {
      ...defaultFarmFilters(),
      gate: 'non-gate',
      minItemLevel: 30,
    });
    expect(result.map((entry) => entry.phase)).toEqual([56]);
  });
});

describe('pickBestFarmRow', () => {
  it('returns null for an empty list', () => {
    expect(pickBestFarmRow([])).toBeNull();
  });

  it('picks the highest goldPerHour row', () => {
    const rows = [
      row({ phase: 1, goldPerHour: 100 }),
      row({ phase: 2, goldPerHour: 300 }),
      row({ phase: 3, goldPerHour: 200 }),
    ];
    expect(pickBestFarmRow(rows)?.phase).toBe(2);
  });

  it('skips infeasible rows even when they carry the highest goldPerHour', () => {
    const rows = [
      row({ phase: 1, goldPerHour: 100, infeasible: false }),
      row({ phase: 2, goldPerHour: 9999, infeasible: true }),
      row({ phase: 3, goldPerHour: 200, infeasible: false }),
    ];
    expect(pickBestFarmRow(rows)?.phase).toBe(3);
  });

  it('returns null when every row is infeasible', () => {
    const rows = [
      row({ phase: 1, goldPerHour: 100, infeasible: true }),
      row({ phase: 2, goldPerHour: 200, infeasible: true }),
    ];
    expect(pickBestFarmRow(rows)).toBeNull();
  });

  it('breaks a goldPerHour tie by the lower phase', () => {
    const rows = [
      row({ phase: 8, goldPerHour: 100 }),
      row({ phase: 2, goldPerHour: 100 }),
      row({ phase: 5, goldPerHour: 100 }),
    ];
    expect(pickBestFarmRow(rows)?.phase).toBe(2);
  });

  it('is independent of input order and of DEFAULT_SORT — an unsorted list still resolves to the max', () => {
    const rows = [
      row({ phase: 4, goldPerHour: 50 }),
      row({ phase: 1, goldPerHour: 400 }),
      row({ phase: 7, goldPerHour: 10 }),
      row({ phase: 3, goldPerHour: 400 }),
    ];
    // Tie between phase 1 and phase 3 at the max value — lower phase wins regardless of position.
    expect(pickBestFarmRow(rows)?.phase).toBe(1);
  });
});

describe('React-free source (both files)', () => {
  it('farm-ranking-view.ts has no React import', () => {
    const source = readFileSync(
      new URL('./farm-ranking-view.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/from ['"]react['"]/);
  });
});

describe('pickContentionNotice', () => {
  const contending = (overrides: Partial<FarmRateRow> = {}) =>
    row({ phase: 51, fieldContentionPct: 26.1, concurrencyScale: 0.988, ...overrides });

  it('reports the row own contention', () => {
    const notice = pickContentionNotice(contending(), 5)!;
    expect(notice.pct).toBeCloseTo(26.1, 9);
  });

  it('reports what the wait COSTS separately from how often it happens — they diverge hard', () => {
    const notice = pickContentionNotice(contending(), 5)!;
    // 26.1% of wall clock with somebody benched costs 1.2% of the rate: the queue is saturated,
    // not idle. Reading the frequency as the cost would overstate the loss twentyfold.
    expect(notice.costPct).toBeCloseTo(1.2, 9);
  });

  it('takes the cost from concurrencyScale, the same factor buildRow already charged', () => {
    expect(pickContentionNotice(contending({ concurrencyScale: 0.9 }), 5)!.costPct).toBeCloseTo(10, 9);
    expect(pickContentionNotice(contending({ concurrencyScale: 1 }), 5)!.costPct).toBeCloseTo(0, 9);
  });

  it('flags a field already at the cap, so the copy can stop prescribing slots that do not exist', () => {
    expect(pickContentionNotice(contending(), FIELD_SLOTS_MAX)!.atMaxSlots).toBe(true);
    expect(pickContentionNotice(contending(), FIELD_SLOTS_MAX - 1)!.atMaxSlots).toBe(false);
  });

  it('treats a field ABOVE the known cap as maxed — a game patch must not resurrect the advice', () => {
    expect(pickContentionNotice(contending(), FIELD_SLOTS_MAX + 3)!.atMaxSlots).toBe(true);
  });

  it('reads an unknown slot count as not-maxed, keeping the actionable copy', () => {
    expect(pickContentionNotice(contending(), null)!.atMaxSlots).toBe(false);
    expect(pickContentionNotice(contending(), undefined)!.atMaxSlots).toBe(false);
  });

  it('stays silent below the threshold, and speaks at exactly the threshold', () => {
    expect(pickContentionNotice(contending({ fieldContentionPct: 4.999 }), 5)).toBeNull();
    expect(pickContentionNotice(contending({ fieldContentionPct: CONTENTION_NOTICE_MIN_PCT }), 5)).not.toBeNull();
  });

  it('stays silent on an uncontended board — the common case, and the one that must not nag', () => {
    expect(pickContentionNotice(contending({ fieldContentionPct: 0, concurrencyScale: 1 }), 5)).toBeNull();
  });

  it('stays silent on an infeasible row, and on no row at all', () => {
    expect(pickContentionNotice(contending({ infeasible: true }), 5)).toBeNull();
    expect(pickContentionNotice(null, 5)).toBeNull();
    expect(pickContentionNotice(undefined, 5)).toBeNull();
  });

  it('never emits NaN from a degenerate row', () => {
    const notice = pickContentionNotice(contending({ fieldContentionPct: 100, concurrencyScale: 0 }), 5)!;
    expect(Number.isFinite(notice.pct)).toBe(true);
    expect(notice.pct).toBeCloseTo(100, 9);
    expect(notice.costPct).toBeCloseTo(100, 9);
    expect(Number.isFinite(pickContentionNotice(contending({ concurrencyScale: Number.NaN }), 5)!.costPct)).toBe(true);
  });
});
