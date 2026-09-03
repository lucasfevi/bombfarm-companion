'use client';

import { AccountTreeView } from '@bombfarm/account/panels';
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

export function AccountTreePanel() {
  const { t, lang } = useAppLang();
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

  return (
    <AccountTreeView
      squadDamagePct={squadDmgPct}
      geoMultiplier={geoMult}
      totalDamage={danoTotal}
      critChancePct={critChance}
      critDamagePct={critDmg}
      speedPct={speed}
      energyPct={energy}
      teamCoinPct={teamCoinPct}
      luckFlatPct={luckFlatPct}
      xpMultiplier={xpMult}
      fieldSlotsBonus={fieldSlotsBonus}
      bagTabsBonus={bagTabsBonus}
      fieldSlots={fieldSlots}
      labels={{
        title: t.panelTree,
        tip: t.accountTreeTip,
        groupDamage: t.accountTreeGroupDamage,
        groupField: t.accountTreeGroupField,
        groupRewards: t.accountTreeGroupRewards,
        squadDamage: t.accountSquadDmg,
        geoMultiplier: t.accountGeoMult,
        totalDamage: t.treeDano,
        critChance: t.treeCrit,
        critDamage: t.treeCritDmg,
        speed: t.treeSpeed,
        energy: t.treeEnergy,
        fieldSlots: t.accountFieldSlots,
        fieldSlotsTip: t.accountFieldSlotsTip,
        gold: t.treeTeamCoin,
        goldTip: t.treeTeamCoinHint,
        luck: t.accountLuckFlat,
        xp: t.treeXpMult,
        bagTabs: t.accountBagTabs,
        percent: (value) => `+${formatNumber(value, lang, 2)}%`,
        multiplier: (value) => `×${formatNumber(value, lang, 3)}`,
        luckPoints: (value) => `+${formatNumber(value, lang, 2)} pp`,
        bonus: (value) => `+${value}`,
        totalDamageTip: (squadDamagePct, geoMultiplier, total) =>
          sub(t.accountTotalDmgTip, {
            squad: formatNumber(squadDamagePct, lang, 2),
            geo: formatNumber(geoMultiplier, lang, 3),
            total: formatNumber(total, lang, 3),
          }),
        bonusOfTotal: (bonus, total) =>
          sub(t.accountBonusOfTotal, { bonus: `+${bonus}`, total: String(total) }),
      }}
    />
  );
}
