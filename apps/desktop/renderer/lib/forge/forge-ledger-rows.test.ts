import { describe, expect, it } from 'vitest';
import type { ForgeHistoryRow } from '@bombfarm/contracts';
import {
  DEFAULT_FORGE_LEDGER_SORT,
  nextForgeLedgerSort,
  sortForgeLedgerRows,
  type ForgeLedgerSort,
} from './forge-ledger-rows';

function row(overrides: Partial<ForgeHistoryRow> & { id: number }): ForgeHistoryRow {
  return {
    startedAt: '2026-09-05T10:00:00.000Z',
    finishedAt: '2026-09-05T10:00:12.000Z',
    accountId: 'a1',
    itemId: `g${String(overrides.id)}`,
    defId: 'steel_luva',
    rarity: 2,
    slot: 2,
    itemLevel: 20,
    fromUpgrade: 8,
    toUpgrade: 12,
    target: 12,
    stop: 'target',
    reached: true,
    rolls: 8,
    fails: 1,
    crits: 0,
    safeJumps: 0,
    spent: 8_000,
    walletAfter: null,
    durationMs: 12_000,
    ...overrides,
  };
}

const ROWS: ForgeHistoryRow[] = [
  row({ id: 3, finishedAt: '2026-09-05T12:00:00.000Z', spent: 5_000, rolls: 4, toUpgrade: 9, stop: 'budget' }),
  row({ id: 2, finishedAt: '2026-09-05T11:00:00.000Z', spent: 9_000, rolls: 4, toUpgrade: 13, stop: 'target' }),
  row({ id: 1, finishedAt: '2026-09-05T10:00:00.000Z', spent: 5_000, rolls: 9, toUpgrade: 11, stop: 'cancelled' }),
];

const NAMES: Record<number, string> = { 1: 'Steel · Boots', 2: 'Steel · Gloves', 3: 'Aqua · Ring' };
const OUTCOMES: Record<number, string> = { 1: 'Cancelled', 2: 'Reached', 3: 'Gold budget' };

const ids = (sort: ForgeLedgerSort) =>
  sortForgeLedgerRows(
    ROWS,
    sort,
    (entry) => NAMES[entry.id] ?? '',
    (entry) => OUTCOMES[entry.id] ?? '',
  ).map((entry) => entry.id);

describe('sortForgeLedgerRows', () => {
  it('opens newest first', () => {
    expect(ids(DEFAULT_FORGE_LEDGER_SORT)).toEqual([3, 2, 1]);
    expect(ids({ key: 'when', direction: 'asc' })).toEqual([1, 2, 3]);
  });

  it('orders words by the caller\'s own text, in both directions', () => {
    expect(ids({ key: 'item', direction: 'asc' })).toEqual([3, 1, 2]);
    expect(ids({ key: 'outcome', direction: 'asc' })).toEqual([1, 3, 2]);
    expect(ids({ key: 'outcome', direction: 'desc' })).toEqual([2, 3, 1]);
  });

  it('orders the numeric columns by their own figure', () => {
    expect(ids({ key: 'spent', direction: 'desc' })).toEqual([2, 3, 1]);
    expect(ids({ key: 'climb', direction: 'desc' })).toEqual([2, 1, 3]);
    expect(ids({ key: 'rolls', direction: 'asc' })).toEqual([3, 2, 1]);
  });

  it('breaks a tie on the row id descending, so equal rows stay newest-first whichever way the column points', () => {
    expect(ids({ key: 'spent', direction: 'asc' })).toEqual([3, 1, 2]);
    expect(ids({ key: 'rolls', direction: 'desc' })).toEqual([1, 3, 2]);
  });

  it('falls back to the row id for a finish time it cannot read', () => {
    const broken = [row({ id: 1, finishedAt: 'not a date' }), row({ id: 2, finishedAt: 'not a date' })];
    const order = sortForgeLedgerRows(broken, DEFAULT_FORGE_LEDGER_SORT, () => '', () => '').map((entry) => entry.id);
    expect(order).toEqual([2, 1]);
  });

  it('leaves the rows it was handed alone', () => {
    const before = ROWS.map((entry) => entry.id);
    ids({ key: 'spent', direction: 'asc' });
    expect(ROWS.map((entry) => entry.id)).toEqual(before);
  });
});

describe('nextForgeLedgerSort', () => {
  it('opens a word column ascending and a number column descending, and flips the one already leading', () => {
    expect(nextForgeLedgerSort(DEFAULT_FORGE_LEDGER_SORT, 'item')).toEqual({ key: 'item', direction: 'asc' });
    expect(nextForgeLedgerSort(DEFAULT_FORGE_LEDGER_SORT, 'outcome')).toEqual({ key: 'outcome', direction: 'asc' });
    expect(nextForgeLedgerSort(DEFAULT_FORGE_LEDGER_SORT, 'spent')).toEqual({ key: 'spent', direction: 'desc' });
    expect(nextForgeLedgerSort(DEFAULT_FORGE_LEDGER_SORT, 'when')).toEqual({ key: 'when', direction: 'asc' });
  });
});
