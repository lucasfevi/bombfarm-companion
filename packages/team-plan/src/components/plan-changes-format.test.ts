import { describe, expect, it } from 'vitest';
import { formatTreeAxisValue, treeAxisMultiplier, treeAxisPercent } from './plan-changes-format';

describe('treeAxisPercent — an axis already in percentage points', () => {
  it('signs a positive value and rounds to two decimals, in each language\'s own separator', () => {
    expect(treeAxisPercent(33.4076577825, 'en')).toBe('+33.41%');
    expect(treeAxisPercent(33.4076577825, 'pt')).toBe('+33,41%');
  });

  it('signs a negative value with the minus glyph, not a hyphen', () => {
    expect(treeAxisPercent(-1.005, 'en')).toBe('−1.01%');
  });

  it('a zero value reads as a plain positive zero', () => {
    expect(treeAxisPercent(0, 'en')).toBe('+0.00%');
  });
});

describe('treeAxisMultiplier — an axis expressed as a raw multiplier', () => {
  it('rounds to three decimals and drops the trailing zeros', () => {
    expect(treeAxisMultiplier(1.234567, 'en')).toBe('×1.235');
    expect(treeAxisMultiplier(1.2, 'en')).toBe('×1.2');
    expect(treeAxisMultiplier(1, 'en')).toBe('×1');
  });

  it('drops the trailing zeros in Portuguese\'s own decimal separator too', () => {
    expect(treeAxisMultiplier(1.2, 'pt')).toBe('×1,2');
  });
});

describe('formatTreeAxisValue — routes each axis to its own shape', () => {
  it('treeDanoTotal and treeXpMult read as multipliers', () => {
    expect(formatTreeAxisValue('treeDanoTotal', 1.41, 'en')).toBe('×1.41');
    expect(formatTreeAxisValue('treeXpMult', 1.2, 'en')).toBe('×1.2');
  });

  it('every other axis reads as a signed percentage already in points', () => {
    expect(formatTreeAxisValue('treeCritChance', 33.4076577825, 'en')).toBe('+33.41%');
    expect(formatTreeAxisValue('treeCritDmg', 10, 'en')).toBe('+10.00%');
    expect(formatTreeAxisValue('treeSpeed', 5, 'en')).toBe('+5.00%');
    expect(formatTreeAxisValue('treeEnergy', 5, 'en')).toBe('+5.00%');
    expect(formatTreeAxisValue('treeTeamCoinPct', 5, 'en')).toBe('+5.00%');
    expect(formatTreeAxisValue('treeLuckFlatPct', 5, 'en')).toBe('+5.00%');
  });
});
