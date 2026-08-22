'use client';

import { Panel, StatList, type StatListItem } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui/panel-field.recipe';
import { AbilityIcon, GoldIcon } from '@/shared/game-art';
import { formatNumber } from '@/shared/lib/format-number';
import { sub } from '@/shared/i18n';
import { useAppLang } from '@/shared/context/app-lang';
import {
  usePlannerStore,
  selectFieldSlots,
  selectTreeBagTabsBonus,
  selectTreeCritChance,
  selectTreeCritDmg,
  selectTreeDanoTotal,
  selectTreeEnergy,
  selectTreeFieldSlotsBonus,
  selectTreeGeoMult,
  selectTreeLuckFlatPct,
  selectTreeSpeed,
  selectTreeSquadDmgPct,
  selectTreeTeamCoinPct,
  selectTreeXpMult,
} from '@/shared/stores';

const pct = (value: number) => `+${formatNumber(value, 2)}%`;
const mult = (value: number) => `×${formatNumber(value, 3)}`;

/** Ability art reused as stat art: each of these is the game's own icon for that stat's node. */
const STAT_ABILITY_ICON = {
  squadDmg: 'grito_guerra',
  critChance: 'olho_clinico',
  critDmg: 'golpe_brutal',
  speed: 'marcha_acelerada',
  energy: 'bateria_extra',
  luck: 'fortuna',
} as const;

export function AccountTreePanel() {
  const { t } = useAppLang();
  const danoTotal = usePlannerStore(selectTreeDanoTotal);
  const squadDmgPct = usePlannerStore(selectTreeSquadDmgPct);
  const geoMult = usePlannerStore(selectTreeGeoMult);
  const critChance = usePlannerStore(selectTreeCritChance);
  const critDmg = usePlannerStore(selectTreeCritDmg);
  const speed = usePlannerStore(selectTreeSpeed);
  const energy = usePlannerStore(selectTreeEnergy);
  const teamCoinPct = usePlannerStore(selectTreeTeamCoinPct);
  const luckFlatPct = usePlannerStore(selectTreeLuckFlatPct);
  const xpMult = usePlannerStore(selectTreeXpMult);
  const fieldSlotsBonus = usePlannerStore(selectTreeFieldSlotsBonus);
  const bagTabsBonus = usePlannerStore(selectTreeBagTabsBonus);
  const fieldSlots = usePlannerStore(selectFieldSlots);

  const damageItems: StatListItem[] = [
    {
      id: 'squad-dmg',
      label: t.accountSquadDmg,
      value: pct(squadDmgPct),
      icon: <AbilityIcon code={STAT_ABILITY_ICON.squadDmg} size="xs" />,
    },
    { id: 'geo-mult', label: t.accountGeoMult, value: mult(geoMult) },
    {
      id: 'dano-total',
      label: t.treeDano,
      // The whole point of this panel's damage block: the game shows three numbers and never
      // says the third is the product of the first two. `dmg_static` is exactly
      // `(1 + team_dmg_add) × geo_mult`, so the working is printed rather than asserted.
      tip: sub(t.accountTotalDmgTip, {
        squad: formatNumber(squadDmgPct, 2),
        geo: formatNumber(geoMult, 3),
        total: formatNumber(danoTotal, 3),
      }),
      value: mult(danoTotal),
    },
  ];

  const statItems: StatListItem[] = [
    {
      id: 'crit-chance',
      label: t.treeCrit,
      value: pct(critChance),
      icon: <AbilityIcon code={STAT_ABILITY_ICON.critChance} size="xs" />,
    },
    {
      id: 'crit-dmg',
      label: t.treeCritDmg,
      value: pct(critDmg),
      icon: <AbilityIcon code={STAT_ABILITY_ICON.critDmg} size="xs" />,
    },
    {
      id: 'speed',
      label: t.treeSpeed,
      value: pct(speed),
      icon: <AbilityIcon code={STAT_ABILITY_ICON.speed} size="xs" />,
    },
    {
      id: 'energy',
      label: t.treeEnergy,
      value: pct(energy),
      icon: <AbilityIcon code={STAT_ABILITY_ICON.energy} size="xs" />,
    },
    {
      id: 'gold',
      label: t.treeTeamCoin,
      tip: t.treeTeamCoinHint,
      value: pct(teamCoinPct),
      icon: <GoldIcon />,
    },
    {
      id: 'luck',
      label: t.accountLuckFlat,
      value: `+${formatNumber(luckFlatPct, 2)} pp`,
      icon: <AbilityIcon code={STAT_ABILITY_ICON.luck} size="xs" />,
    },
    { id: 'xp', label: t.treeXpMult, value: mult(xpMult) },
    {
      id: 'field-slots',
      label: t.accountFieldSlots,
      // The game's own summary shows the tree's BONUS; the usable total is one more, and it is
      // the total every farm computation caps the field at. Both, so neither reading surprises.
      tip: t.accountFieldSlotsTip,
      value: fieldSlots != null ? sub(t.accountBonusOfTotal, { bonus: `+${fieldSlotsBonus}`, total: String(fieldSlots) }) : `+${fieldSlotsBonus}`,
    },
    { id: 'bag-tabs', label: t.accountBagTabs, value: `+${bagTabsBonus}` },
  ];

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.panelTree}</h2>
      </div>
      <p className={tipClass}>{t.accountTreeTip}</p>
      <StatList variant="phases" items={damageItems} aria-label={t.accountTreeDamageGroup} />
      <div className="mt-3 border-t border-line pt-3">
        <StatList variant="phases" items={statItems} aria-label={t.accountTreeBonusGroup} />
      </div>
    </Panel>
  );
}
