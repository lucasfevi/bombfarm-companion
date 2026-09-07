import { describe, expect, it } from 'vitest';
import { fallbackNoteText } from '@bombfarm/hero/components';
import { statPanelCopyFor } from '@bombfarm/hero/copy';
import type { PointValue } from '@bombfarm/domain/model';
import { SHEET_PANEL_KEYS } from '@bombfarm/domain/planner-constants';
import { breakdownSheetKeys, heroNextPointRanking } from './hero-detail-panels';

type BreakdownInput = Parameters<typeof breakdownSheetKeys>[0];

const SHEET: BreakdownInput['adjusted'] = {
  attack: 1000,
  energy: 200,
  speed: 50,
  critChance: 30,
  critDmg: 120,
  penetration: 10,
  cdr: 40,
  luck: 12,
};

/** The same sheet on both sides, then the combat-effective side moved where a case needs it. */
function facts(combatMoved: Partial<BreakdownInput['effective']>): BreakdownInput {
  return {
    adjusted: { ...SHEET },
    effective: {
      ...SHEET,
      rarity: 'Lendária',
      attackPerPoint: 1,
      energyPerPoint: 1,
      ...combatMoved,
    },
  };
}

describe('breakdownSheetKeys', () => {
  it('lists only the stats combat has moved away from the sheet total', () => {
    expect(breakdownSheetKeys(facts({ attack: 1400, cdr: 55 }))).toEqual(['attack', 'cdr']);
  });

  it('a hero with no abilities and no team buffs gets no sheet rows at all', () => {
    expect(breakdownSheetKeys(facts({}))).toEqual([]);
  });

  it('Luck is never listed, even when every other stat moved — it does not reach the combat sheet at all', () => {
    const everythingMoved = facts({
      attack: 1400,
      energy: 260,
      speed: 60,
      critChance: 40,
      critDmg: 150,
      penetration: 20,
      cdr: 55,
    });
    expect(SHEET_PANEL_KEYS).toContain('luck');
    expect(breakdownSheetKeys(everythingMoved)).not.toContain('luck');
  });

  it('a difference far below display precision is not a row', () => {
    expect(breakdownSheetKeys(facts({ speed: 50 + 1e-12 }))).toEqual([]);
  });
});

const RANKING: readonly PointValue[] = [
  { stat: 'critDmg', label: 'Crit Damage', gainPct: 3.2 },
  { stat: 'speed', label: 'Speed', gainPct: 1.1 },
];

describe('heroNextPointRanking', () => {
  it('hands the damage ranking through untouched, and reports no fallback', () => {
    const ranking = heroNextPointRanking('dps', RANKING);
    expect(ranking.rows).toBe(RANKING);
    expect(ranking.fallback).toBeNull();
    expect(ranking.addedToPool).toBe(false);
  });

  it('farm mode keeps the same rows and names why farming could not be answered', () => {
    const ranking = heroNextPointRanking('farm', RANKING);
    expect(ranking.rows).toBe(RANKING);
    expect(ranking.fallback).toBe('emptyPool');
  });

  it('the farm fallback renders as the no-rotation note, in both languages', () => {
    expect(heroNextPointRanking('farm', RANKING).fallback).toBe('emptyPool');
    expect(fallbackNoteText('emptyPool', statPanelCopyFor('en'))).toBe(
      statPanelCopyFor('en').rankFarmNoPool,
    );
    expect(fallbackNoteText('emptyPool', statPanelCopyFor('pt'))).toBe(
      statPanelCopyFor('pt').rankFarmNoPool,
    );
  });

  it('an empty ranking is never how farm-unavailable is expressed', () => {
    expect(heroNextPointRanking('farm', RANKING).rows).not.toEqual([]);
  });
});
