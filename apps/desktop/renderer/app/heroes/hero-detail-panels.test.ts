import { describe, expect, it } from 'vitest';
import { fallbackNoteText } from '@bombfarm/hero/components';
import { statPanelCopyFor } from '@bombfarm/hero/copy';
import type { PointValue } from '@bombfarm/domain/model';
import { heroNextPointRanking } from './hero-detail-panels';

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
