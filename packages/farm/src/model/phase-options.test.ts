import { describe, expect, it } from 'vitest';
import { WIKI_PHASE_LINES } from '@bombfarm/domain/phase-wiki';
import { phaseFromSearchValue, phaseSearchOptions, phaseSearchValue } from './phase-options';

describe('phaseSearchOptions', () => {
  it('lists every wiki phase once, in order, under the app’s one phase spelling', () => {
    const options = phaseSearchOptions('en');
    expect(options).toHaveLength(WIKI_PHASE_LINES.length);
    expect(options[0]).toEqual({ value: '1', label: 'Easy 1-1 (#1)' });
    expect(options.find((option) => option.value === '151')?.label).toBe('Hard 1-1 (#151)');
  });

  it('translates the difficulty word and nothing else', () => {
    expect(phaseSearchOptions('pt').find((option) => option.value === '151')?.label).toBe(
      'Difícil 1-1 (#151)',
    );
  });
});

describe('the control value round-trips a phase', () => {
  it('a phase becomes its own digits and comes back as the same number', () => {
    expect(phaseFromSearchValue(phaseSearchValue(137))).toBe(137);
  });

  it('a value no phase carries reads as no phase rather than as NaN', () => {
    expect(phaseFromSearchValue('')).toBeNull();
    expect(phaseFromSearchValue('none')).toBeNull();
  });
});
