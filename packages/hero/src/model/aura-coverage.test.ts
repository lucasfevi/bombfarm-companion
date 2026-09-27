import { describe, expect, it } from 'vitest';
import { TEAM_ABILITY_IDS } from '@bombfarm/domain/ability-effect-readout';
import { numberFormatterFor } from '@bombfarm/ui';
import { auraCoverageFor, type AuraCoverageTile } from './aura-coverage';

const en = numberFormatterFor('en');

function tile(tiles: readonly AuraCoverageTile[], auraId: string): AuraCoverageTile {
  const found = tiles.find((entry) => entry.auraId === auraId);
  if (found === undefined) throw new Error(`no tile for ${auraId}`);
  return found;
}

describe('auraCoverageFor', () => {
  it('lists the seven team auras in the domain order, Fortune last', () => {
    const coverage = auraCoverageFor([], 'en', en);
    expect(coverage.tiles.map((entry) => entry.auraId)).toEqual([...TEAM_ABILITY_IDS]);
    expect(coverage.tiles.map((entry) => entry.auraId)).toEqual([
      'grito_guerra',
      'pressagio_mortal',
      'marcha_acelerada',
      'folego_mineiro',
      'brecha',
      'passagem_bastao',
      'fortuna',
    ]);
    expect(coverage.total).toBe(7);
  });

  it('prints each covered aura at its carrier level with the domain readout', () => {
    const coverage = auraCoverageFor([{ abilities: { grito_guerra: 20, fortuna: 20 } }], 'en', en);
    expect(tile(coverage.tiles, 'grito_guerra')).toMatchObject({
      covered: true,
      level: 20,
      maxLevel: 20,
      valueText: '+20% attack',
    });
    expect(tile(coverage.tiles, 'fortuna')).toMatchObject({ covered: true, level: 20 });
    expect(coverage.coveredCount).toBe(2);
  });

  it('marks Fortune uncovered for a squad without a carrier', () => {
    const coverage = auraCoverageFor(
      [{ abilities: { grito_guerra: 5, brecha: 10 } }, { abilities: { matilha: 20 } }],
      'en',
      en,
    );
    expect(tile(coverage.tiles, 'fortuna')).toEqual({
      auraId: 'fortuna',
      covered: false,
      maxLevel: 20,
    });
    expect(coverage.coveredCount).toBe(2);
  });

  it('reads two carriers of one aura at the stronger level', () => {
    const coverage = auraCoverageFor(
      [{ abilities: { pressagio_mortal: 7 } }, { abilities: { pressagio_mortal: 16 } }],
      'en',
      en,
    );
    expect(tile(coverage.tiles, 'pressagio_mortal')).toMatchObject({ covered: true, level: 16 });
    expect(coverage.coveredCount).toBe(1);
  });

  it('does not count an unspent aura slot as covering it', () => {
    const coverage = auraCoverageFor([{ abilities: { brecha: 0 } }], 'en', en);
    expect(tile(coverage.tiles, 'brecha').covered).toBe(false);
  });

  it('does not call Pack a team aura', () => {
    const coverage = auraCoverageFor([{ abilities: { matilha: 20 } }], 'en', en);
    expect(coverage.tiles.map((entry) => entry.auraId)).not.toContain('matilha');
    expect(coverage.coveredCount).toBe(0);
  });

  it('prints the readout in the reader’s language', () => {
    const coverage = auraCoverageFor([{ abilities: { fortuna: 20 } }], 'pt', numberFormatterFor('pt'));
    const fortune = tile(coverage.tiles, 'fortuna');
    expect(fortune.covered && fortune.valueText).toMatch(/10/);
  });
});
