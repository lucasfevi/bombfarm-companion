import { describe, expect, it } from 'vitest';
import type { TeamPlanPerHeroRow } from '@bombfarm/domain/team-plan/types';
import {
  DEFAULT_TEAM_PLAN_RESULT_SORT,
  firstResultSortDirection,
  normalizeTeamPlanResultSort,
  sortTeamPlanResultRows,
} from './result-order';

const ZERO_STATS = {
  attack: 0,
  energy: 0,
  speed: 0,
  critChance: 0,
  critDmg: 0,
  penetration: 0,
  cdr: 0,
  luck: 0,
};

function row(
  heroId: string,
  heroName: string,
  figures: { before: number; after: number; level?: number },
): TeamPlanPerHeroRow {
  return {
    heroId,
    heroName,
    level: figures.level ?? 50,
    before: figures.before,
    after: figures.after,
    delta: figures.after - figures.before,
    combatStatsBefore: ZERO_STATS,
    combatStatsAfter: ZERO_STATS,
    sheetStatsBefore: ZERO_STATS,
    sheetStatsAfter: ZERO_STATS,
    hitBefore: 0,
    hitAfter: 0,
  };
}

const small = row('1', 'Cora', { before: 100, after: 150, level: 30 });
const big = row('2', 'Ajax', { before: 1000, after: 1200, level: 90 });
const idle = row('3', 'Bram', { before: 0, after: 80, level: 60 });
const ROWS = [small, big, idle];

function names(rows: readonly TeamPlanPerHeroRow[]): string[] {
  return rows.map((entry) => entry.heroName);
}

describe('sortTeamPlanResultRows', () => {
  it("keeps the plan's own name order by default", () => {
    expect(names(sortTeamPlanResultRows(ROWS, DEFAULT_TEAM_PLAN_RESULT_SORT))).toEqual(['Ajax', 'Bram', 'Cora']);
  });

  it('puts the biggest DPS gain first when descending by gain', () => {
    expect(names(sortTeamPlanResultRows(ROWS, { key: 'delta', direction: 'desc' }))).toEqual(['Ajax', 'Bram', 'Cora']);
    expect(names(sortTeamPlanResultRows(ROWS, { key: 'delta', direction: 'asc' }))).toEqual(['Cora', 'Bram', 'Ajax']);
  });

  it('ranks relative gain apart from absolute gain, with a hero doing no damage today last either way', () => {
    expect(names(sortTeamPlanResultRows(ROWS, { key: 'deltaPct', direction: 'desc' }))).toEqual(['Cora', 'Ajax', 'Bram']);
    expect(names(sortTeamPlanResultRows(ROWS, { key: 'deltaPct', direction: 'asc' }))).toEqual(['Ajax', 'Cora', 'Bram']);
  });

  it('orders by DPS after, DPS before and level', () => {
    expect(names(sortTeamPlanResultRows(ROWS, { key: 'after', direction: 'desc' }))).toEqual(['Ajax', 'Cora', 'Bram']);
    expect(names(sortTeamPlanResultRows(ROWS, { key: 'before', direction: 'desc' }))).toEqual(['Ajax', 'Cora', 'Bram']);
    expect(names(sortTeamPlanResultRows(ROWS, { key: 'level', direction: 'asc' }))).toEqual(['Cora', 'Bram', 'Ajax']);
  });

  it('breaks a tie by name, so equal figures never reshuffle', () => {
    const zed = row('9', 'Zed', { before: 10, after: 20 });
    const abe = row('8', 'Abe', { before: 10, after: 20 });
    expect(names(sortTeamPlanResultRows([zed, abe], { key: 'delta', direction: 'desc' }))).toEqual(['Abe', 'Zed']);
  });

  it('never reorders the rows it was given', () => {
    const input = [...ROWS];
    sortTeamPlanResultRows(input, { key: 'delta', direction: 'desc' });
    expect(input).toEqual(ROWS);
  });
});

describe('firstResultSortDirection', () => {
  it('starts a name at A and every figure at its biggest', () => {
    expect(firstResultSortDirection('name')).toBe('asc');
    expect(firstResultSortDirection('delta')).toBe('desc');
    expect(firstResultSortDirection('level')).toBe('desc');
  });
});

describe('normalizeTeamPlanResultSort', () => {
  it('reads back a stored sort', () => {
    expect(normalizeTeamPlanResultSort({ key: 'deltaPct', direction: 'asc' })).toEqual({
      key: 'deltaPct',
      direction: 'asc',
    });
  });

  it('gives a known key with an unreadable direction its natural direction', () => {
    expect(normalizeTeamPlanResultSort({ key: 'after', direction: 'sideways' })).toEqual({
      key: 'after',
      direction: 'desc',
    });
  });

  it.each([null, undefined, 'delta', 42, [], { key: 'power', direction: 'desc' }])('reads %j as the default', (value) => {
    expect(normalizeTeamPlanResultSort(value)).toEqual(DEFAULT_TEAM_PLAN_RESULT_SORT);
  });
});
