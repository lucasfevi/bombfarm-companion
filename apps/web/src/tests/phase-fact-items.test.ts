import { describe, expect, it } from 'vitest';
import { computePhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { STRINGS } from '@/shared/i18n';
import {
  economyItems,
  jaulaChestOdds,
  jaulaItems,
  mapFactItems,
} from '@/features/phases/model/phase-fact-items';

describe('phase-fact-items', () => {
  const t = STRINGS.pt;
  const fmt = (n: number, d = 0) => n.toFixed(d);

  it('mapFactItems returns the frozen nine row ids', () => {
    const intel = computePhaseIntelGlobal(1, 0)!;
    const items = mapFactItems(intel, t, fmt, 'pt');
    expect(items.map((row) => row.id)).toEqual([
      'mapName',
      'stone',
      'mit',
      'props',
      'avgHp',
      'mapHp',
      'boss',
      'gateTimer',
      'gateKey',
    ]);
  });

  it('economyItems returns the frozen eight row ids', () => {
    const intel = computePhaseIntelGlobal(1, 0)!;
    const items = economyItems(intel, t, fmt);
    expect(items.map((row) => row.id)).toEqual([
      'drops',
      'xp',
      'goldWiki',
      'goldActual',
      'avgGoldWiki',
      'avgGoldActual',
      'mapGoldWiki',
      'mapGoldActual',
    ]);
  });

  it('jaulaItems returns the frozen four row ids', () => {
    const intel = computePhaseIntelGlobal(1, 0)!;
    const items = jaulaItems(intel, t, fmt, 'pt');
    expect(items.map((row) => row.id)).toEqual(['early', 'window', 'hp', 'chest']);
  });

  it('jaulaChestOdds returns em dash when all probabilities are zero', () => {
    expect(jaulaChestOdds([0, 0, 0], fmt, 'pt')).toBe('—');
  });
});
