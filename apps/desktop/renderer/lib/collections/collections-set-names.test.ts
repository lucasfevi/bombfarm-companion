import { describe, expect, it } from 'vitest';
import { buildCollectionBoard } from '@bombfarm/domain/model';
import { COLLECTION_AXES } from '@bombfarm/contracts';
import { collectionsSnapshotFixture, defined } from './collections-test-fixture';
import { axisSetEntries, fitSetNames, SET_LINE_BUDGET, type AxisSetEntry } from './collections-set-names';

const board = buildCollectionBoard(collectionsSnapshotFixture());
const rowOf = (axis: string) => defined(board.axes.find((row) => row.axis === axis), axis);

function entries(...names: string[]): AxisSetEntry[] {
  return names.map((name) => ({ name, grants: false }));
}

describe('axisSetEntries', () => {
  it('names the sets that grant the axis in level order, through the set-name helper, in either language', () => {
    expect(axisSetEntries(rowOf('gold'), board.sets, 'en').map((entry) => entry.name)).toEqual(['Gold', 'Desert', 'Silver']);
    expect(axisSetEntries(rowOf('gold'), board.sets, 'pt').map((entry) => entry.name)).toEqual(['Ouro', 'Deserto', 'Prata']);
  });

  it('marks the sets that already grant something on this axis, and only those', () => {
    expect(axisSetEntries(rowOf('gold'), board.sets, 'en').map((entry) => entry.grants)).toEqual([true, false, false]);
    expect(axisSetEntries(rowOf('critChance'), board.sets, 'en').map((entry) => entry.grants)).toEqual([true, false]);
  });

  it('lists the three-effect book under each of its three axes, once each', () => {
    const under = COLLECTION_AXES.filter((axis) => rowOf(axis).setCodes.includes('void'));
    expect(under).toEqual(['damage', 'critDamage', 'cooldown']);
    const voidOnDamage = axisSetEntries(rowOf('damage'), board.sets, 'en').find((entry) => entry.name === 'Void');
    expect(voidOnDamage?.grants).toBe(true);
  });

  it('has as many entries as the axis has books', () => {
    for (const row of board.axes) expect(axisSetEntries(row, board.sets, 'en')).toHaveLength(row.books);
  });
});

describe('fitSetNames', () => {
  it('shows every name when they fit the budget', () => {
    expect(fitSetNames(entries('Gold', 'Desert', 'Silver'))).toMatchObject({ hidden: 0 });
    expect(fitSetNames(entries('Gold', 'Desert', 'Silver')).shown).toHaveLength(3);
  });

  it('shows the first names that fit and counts the rest, keeping room for the marker', () => {
    const fitted = fitSetNames(entries('Ember', 'Steel', 'Toxic', 'Sunfire', 'Void'));
    expect(fitted.shown.map((entry) => entry.name)).toEqual(['Ember', 'Steel', 'Toxic']);
    expect(fitted.hidden).toBe(2);
  });

  it('keeps the line, marker included, inside the budget', () => {
    const fitted = fitSetNames(entries('Ember', 'Steel', 'Toxic', 'Sunfire', 'Void'));
    const line = fitted.shown.map((entry) => entry.name).join(' · ') + ` · +${String(fitted.hidden)}`;
    expect(line.length).toBeLessThanOrEqual(SET_LINE_BUDGET);
  });

  it('always shows the first name, even one longer than the budget', () => {
    const fitted = fitSetNames(entries('A very long set name indeed, longer than any budget', 'Next'));
    expect(fitted.shown).toHaveLength(1);
    expect(fitted.hidden).toBe(1);
  });

  it('shows nothing and hides nothing for an axis no book grants', () => {
    expect(fitSetNames([])).toEqual({ shown: [], hidden: 0 });
  });

  it('honours a different budget', () => {
    expect(fitSetNames(entries('Ember', 'Steel', 'Toxic'), 12)).toMatchObject({ hidden: 2 });
    expect(fitSetNames(entries('Ember', 'Steel', 'Toxic'), 60)).toMatchObject({ hidden: 0 });
  });
});
