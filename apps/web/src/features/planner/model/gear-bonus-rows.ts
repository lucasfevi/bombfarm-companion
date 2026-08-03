import { gearBonusDeltas, type GearBonuses } from '@bombfarm/domain/gear';
import type { Strings } from '@/shared/i18n';

export type GearBonusRow = {
  key: keyof GearBonuses;
  label: string;
  current: number;
  clone?: number;
  delta?: number;
  percent: boolean;
};

export function gearBonusRows(
  current: GearBonuses,
  strings: Strings,
  clone?: GearBonuses,
): GearBonusRow[] {
  const deltas = clone ? gearBonusDeltas(current, clone) : null;
  const bonusValue = (bonuses: GearBonuses, key: keyof GearBonuses, percent: boolean) =>
    percent ? bonuses[key] * 100 : bonuses[key];

  const defs: { key: keyof GearBonuses; label: string; percent: boolean }[] = [
    { key: 'dmgFlat', label: strings.slotStatFullLabels.dmg, percent: false },
    { key: 'energyPct', label: strings.slotStatFullLabels.energia, percent: true },
    { key: 'speedPct', label: strings.slotStatFullLabels.velocidade, percent: true },
    { key: 'luckPct', label: strings.slotStatFullLabels.sorte, percent: true },
    { key: 'critPct', label: strings.slotStatFullLabels.crit, percent: true },
    { key: 'penPct', label: strings.slotStatFullLabels.penetracao, percent: true },
    { key: 'cdrPct', label: strings.slotStatFullLabels.cooldown, percent: true },
  ];

  return defs.map(({ key, label, percent }) => ({
    key,
    label,
    current: bonusValue(current, key, percent),
    clone: clone ? bonusValue(clone, key, percent) : undefined,
    delta: deltas ? (percent ? deltas[key] * 100 : deltas[key]) : undefined,
    percent,
  }));
}

export function formatBonus(formatNumber: (n: number, d?: number) => string, value: number, percent: boolean) {
  return `+${formatNumber(value, 1)}${percent ? '%' : ''}`;
}
