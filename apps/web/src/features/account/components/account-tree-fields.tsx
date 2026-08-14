'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { Fields } from '@bombfarm/ui';
import { formatNumber } from '@/shared/lib/format-number';
import {
  usePlannerStore,
  selectTreeCritChance,
  selectTreeCritDmg,
  selectTreeDanoTotal,
  selectTreeEnergy,
  selectTreeSpeed,
  selectTreeTeamCoinPct,
} from '@/shared/stores';
import { accountStackAlignClass, accountTreeValueClass } from '@bombfarm/ui/panel-field.recipe';

export function AccountTreeFields() {
  const { t } = useAppLang();
  const treeDanoTotal = usePlannerStore(selectTreeDanoTotal);
  const treeCritChance = usePlannerStore(selectTreeCritChance);
  const treeCritDmg = usePlannerStore(selectTreeCritDmg);
  const treeSpeed = usePlannerStore(selectTreeSpeed);
  const treeEnergy = usePlannerStore(selectTreeEnergy);
  const treeTeamCoinPct = usePlannerStore(selectTreeTeamCoinPct);

  return (
    <Fields layout="stack" className={accountStackAlignClass}>
      <label>
        <span>{t.treeDano}</span>
        <output data-account-tree-value className={accountTreeValueClass}>
          {formatNumber(treeDanoTotal, 3)}
        </output>
      </label>
      <label>
        <span>{t.treeCrit}</span>
        <output data-account-tree-value className={accountTreeValueClass}>
          {formatNumber(treeCritChance, 2)}
        </output>
      </label>
      <label>
        <span>{t.treeCritDmg}</span>
        <output data-account-tree-value className={accountTreeValueClass}>
          {formatNumber(treeCritDmg, 2)}
        </output>
      </label>
      <label>
        <span>{t.treeSpeed}</span>
        <output data-account-tree-value className={accountTreeValueClass}>
          {formatNumber(treeSpeed, 2)}
        </output>
      </label>
      <label>
        <span>{t.treeEnergy}</span>
        <output data-account-tree-value className={accountTreeValueClass}>
          {formatNumber(treeEnergy, 2)}
        </output>
      </label>
      <label>
        <span>
          {t.treeTeamCoin}
          <span data-field-hint>{t.treeTeamCoinHint}</span>
        </span>
        <output data-account-tree-value className={accountTreeValueClass}>
          {formatNumber(treeTeamCoinPct, 2)}
        </output>
      </label>
    </Fields>
  );
}
