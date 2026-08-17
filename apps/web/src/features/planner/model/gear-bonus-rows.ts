import { gearBonusDeltas, type GearBonuses } from '@bombfarm/domain/gear';
import type { Strings } from '@/shared/i18n';

export type GearBonusRow = {
  key: keyof GearBonuses;
  label: string;
  current: number;
  clone?: number;
  delta?: number;
  /** Render with a trailing `%`. Independent of {@link GearBonusDef.scale} — see below. */
  percent: boolean;
};

/**
 * How a `GearBonuses` field reaches the display, in two INDEPENDENT parts.
 *
 * `scale` converts the stored value into display units. `percent` only decides whether a `%`
 * is appended. They used to be one boolean, which was correct while every percent-suffixed
 * field was also a dimensionless fraction needing `× 100`. The 2026-08-15 patch broke that
 * coupling: `critFlatPct` / `cdrFlatPct` are **already** planner percentage points (the same
 * units as `SheetStats.critChance` / `.cdr`, converted once in `sumGearBonuses`), so they are
 * suffixed `%` but must NOT be scaled again — a shared boolean rendered a +7.4pp crit roll as
 * "+744.0%".
 */
type GearBonusDef = {
  key: keyof GearBonuses;
  label: string;
  percent: boolean;
  /** 100 for dimensionless pool fractions; 1 for values already in display units. */
  scale: 1 | 100;
};

export function gearBonusRows(
  current: GearBonuses,
  strings: Strings,
  clone?: GearBonuses,
): GearBonusRow[] {
  const deltas = clone ? gearBonusDeltas(current, clone) : null;

  const defs: GearBonusDef[] = [
    { key: 'dmgFlat', label: strings.slotStatFullLabels.dmg, percent: false, scale: 1 },
    { key: 'dmgPct', label: strings.dmgPctLabel, percent: true, scale: 100 },
    { key: 'energyPct', label: strings.slotStatFullLabels.energia, percent: true, scale: 100 },
    { key: 'speedPct', label: strings.slotStatFullLabels.velocidade, percent: true, scale: 100 },
    { key: 'luckPct', label: strings.slotStatFullLabels.sorte, percent: true, scale: 100 },
    // Already planner percentage points — scale 1, not 100. See GearBonusDef.
    { key: 'critFlatPct', label: strings.slotStatFullLabels.crit, percent: true, scale: 1 },
    { key: 'penPct', label: strings.slotStatFullLabels.penetracao, percent: true, scale: 100 },
    { key: 'cdrFlatPct', label: strings.slotStatFullLabels.cooldown, percent: true, scale: 1 },
  ];

  return defs.map(({ key, label, percent, scale }) => ({
    key,
    label,
    current: current[key] * scale,
    clone: clone ? clone[key] * scale : undefined,
    delta: deltas ? deltas[key] * scale : undefined,
    percent,
  }));
}

export function formatBonus(formatNumber: (n: number, d?: number) => string, value: number, percent: boolean) {
  return `+${formatNumber(value, 1)}${percent ? '%' : ''}`;
}
