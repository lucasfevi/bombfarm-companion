import { describe, expect, it } from 'vitest';
import { SHEET_PANEL_KEYS } from '@bombfarm/domain/planner-constants';
import { SHEET_STAT_CODES } from './sheet-stat-codes';

describe('SHEET_STAT_CODES', () => {
  it('names all eight sheet stats', () => {
    expect(SHEET_STAT_CODES).toEqual({
      attack: 'ATK',
      energy: 'ENE',
      speed: 'SPD',
      luck: 'LCK',
      critChance: 'CrC',
      critDmg: 'CrD',
      penetration: 'PEN',
      cdr: 'CDR',
    });
    expect(Object.keys(SHEET_STAT_CODES).sort()).toEqual([...SHEET_PANEL_KEYS].sort());
  });

  it('gives every stat its own code, which cutting the translated names did not', () => {
    const codes = Object.values(SHEET_STAT_CODES);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toHaveLength(3);
  });
});
