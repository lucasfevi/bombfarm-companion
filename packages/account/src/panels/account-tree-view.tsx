import {
  Panel,
  StatList,
  accountStatListClass,
  heroAbilTitleClass,
  panelHClass,
  panelTitleClass,
  tipClass,
  type StatListItem,
} from '@bombfarm/ui';

export interface AccountTreeLabels {
  title: string;
  tip: string;
  groupDamage: string;
  groupField: string;
  groupRewards: string;
  squadDamage: string;
  geoMultiplier: string;
  totalDamage: string;
  critChance: string;
  critDamage: string;
  speed: string;
  energy: string;
  fieldSlots: string;
  fieldSlotsTip: string;
  gold: string;
  goldTip: string;
  luck: string;
  xp: string;
  bagTabs: string;
  percent: (value: number) => string;
  multiplier: (value: number) => string;
  luckPoints: (value: number) => string;
  /** A bare additive bonus, for a row whose usable total is unknown or has no total at all. */
  bonus: (value: number) => string;
  /** Prints the product the game never spells out: squad damage and geo multiplier into a total. */
  totalDamageTip: (squadDamagePct: number, geoMultiplier: number, total: number) => string;
  bonusOfTotal: (bonus: number, total: number) => string;
}

export interface AccountTreeViewProps {
  squadDamagePct: number;
  geoMultiplier: number;
  totalDamage: number;
  critChancePct: number;
  critDamagePct: number;
  speedPct: number;
  energyPct: number;
  teamCoinPct: number;
  luckFlatPct: number;
  xpMultiplier: number;
  fieldSlotsBonus: number;
  bagTabsBonus: number;
  /** The usable field width, or `null` when the account did not report one. */
  fieldSlots: number | null;
  labels: AccountTreeLabels;
}

export function AccountTreeView({
  squadDamagePct,
  geoMultiplier,
  totalDamage,
  critChancePct,
  critDamagePct,
  speedPct,
  energyPct,
  teamCoinPct,
  luckFlatPct,
  xpMultiplier,
  fieldSlotsBonus,
  bagTabsBonus,
  fieldSlots,
  labels,
}: AccountTreeViewProps) {
  const damageItems: StatListItem[] = [
    { id: 'squad-dmg', label: labels.squadDamage, value: labels.percent(squadDamagePct) },
    { id: 'geo-mult', label: labels.geoMultiplier, value: labels.multiplier(geoMultiplier) },
    {
      id: 'dano-total',
      label: labels.totalDamage,
      // The whole point of this panel's damage block: the game shows three numbers and never
      // says the third is the product of the first two, so the working is printed rather than
      // asserted.
      tip: labels.totalDamageTip(squadDamagePct, geoMultiplier, totalDamage),
      value: labels.multiplier(totalDamage),
    },
    { id: 'crit-chance', label: labels.critChance, value: labels.percent(critChancePct) },
    { id: 'crit-dmg', label: labels.critDamage, value: labels.percent(critDamagePct) },
  ];

  const fieldItems: StatListItem[] = [
    { id: 'speed', label: labels.speed, value: labels.percent(speedPct) },
    { id: 'energy', label: labels.energy, value: labels.percent(energyPct) },
    {
      id: 'field-slots',
      label: labels.fieldSlots,
      // The game's own summary shows the tree's BONUS; the usable total is one more, and it is
      // the total every farm computation caps the field at. Both, so neither reading surprises.
      tip: labels.fieldSlotsTip,
      value:
        fieldSlots != null
          ? labels.bonusOfTotal(fieldSlotsBonus, fieldSlots)
          : labels.bonus(fieldSlotsBonus),
    },
  ];

  const rewardItems: StatListItem[] = [
    { id: 'gold', label: labels.gold, tip: labels.goldTip, value: labels.percent(teamCoinPct) },
    { id: 'luck', label: labels.luck, value: labels.luckPoints(luckFlatPct) },
    { id: 'xp', label: labels.xp, value: labels.multiplier(xpMultiplier) },
    { id: 'bag-tabs', label: labels.bagTabs, value: labels.bonus(bagTabsBonus) },
  ];

  const groups = [
    { id: 'damage', heading: labels.groupDamage, items: damageItems },
    { id: 'field', heading: labels.groupField, items: fieldItems },
    { id: 'rewards', heading: labels.groupRewards, items: rewardItems },
  ];

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{labels.title}</h2>
      </div>
      <p className={tipClass}>{labels.tip}</p>
      {groups.map((group, index) => (
        <div key={group.id} className={index === 0 ? undefined : 'mt-3 border-t border-line pt-3'}>
          <h3 className={heroAbilTitleClass}>{group.heading}</h3>
          <StatList
            variant="phases"
            className={accountStatListClass}
            items={group.items}
            aria-label={group.heading}
          />
        </div>
      ))}
    </Panel>
  );
}
