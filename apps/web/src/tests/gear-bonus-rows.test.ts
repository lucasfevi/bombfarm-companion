import { describe, expect, it } from 'vitest';
import { gearBonusRows, formatBonus } from '@/features/planner/model/gear-bonus-rows';
import { STRINGS } from '@/shared/i18n';
import type { GearBonuses } from '@bombfarm/domain/gear';

const t = STRINGS.en;

const fmt = (n: number, d = 0) => n.toFixed(d);

const current: GearBonuses = {
  dmgFlat: 10,
  energyPct: 0.1,
  speedPct: 0.2,
  luckPct: 0.05,
  critPct: 0.15,
  penPct: 0.03,
  cdrPct: 0.08,
};

const clone: GearBonuses = {
  dmgFlat: 20,
  energyPct: 0.2,
  speedPct: 0.1,
  luckPct: 0.05,
  critPct: 0.25,
  penPct: 0.01,
  cdrPct: 0.08,
};

describe('gearBonusRows', () => {
  it('returns one row per GearBonuses key, in the fixed column order, without a clone', () => {
    const rows = gearBonusRows(current, t);
    expect(rows.map((r) => r.key)).toEqual([
      'dmgFlat',
      'energyPct',
      'speedPct',
      'luckPct',
      'critPct',
      'penPct',
      'cdrPct',
    ]);
    expect(rows.every((r) => r.clone === undefined && r.delta === undefined)).toBe(true);
  });

  it('scales percentage keys to their display value (×100) but leaves dmgFlat raw', () => {
    const rows = gearBonusRows(current, t);
    const dmg = rows.find((r) => r.key === 'dmgFlat')!;
    const energy = rows.find((r) => r.key === 'energyPct')!;
    expect(dmg.current).toBe(10);
    expect(dmg.percent).toBe(false);
    expect(energy.current).toBe(10); // 0.1 * 100
    expect(energy.percent).toBe(true);
  });

  it('computes clone value and delta (in display units) when a clone is supplied', () => {
    const rows = gearBonusRows(current, t, clone);
    const dmg = rows.find((r) => r.key === 'dmgFlat')!;
    const energy = rows.find((r) => r.key === 'energyPct')!;
    expect(dmg.clone).toBe(20);
    expect(dmg.delta).toBe(10);
    expect(energy.clone).toBe(20); // 0.2 * 100
    expect(energy.delta).toBeCloseTo(10, 5); // (0.2 - 0.1) * 100
  });

  it('uses the localized slotStatFullLabels for each row label', () => {
    const rows = gearBonusRows(current, t);
    expect(rows.find((r) => r.key === 'dmgFlat')!.label).toBe(t.slotStatFullLabels.dmg);
    expect(rows.find((r) => r.key === 'critPct')!.label).toBe(t.slotStatFullLabels.crit);
  });
});

describe('formatBonus', () => {
  it('prefixes a plus sign and appends a percent sign for percent rows', () => {
    expect(formatBonus(fmt, 12.34, true)).toBe('+12.3%');
  });

  it('omits the percent sign for non-percent (flat) rows', () => {
    expect(formatBonus(fmt, 5, false)).toBe('+5.0');
  });
});
