'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { Fields, Switch } from '@bombfarm/ui';
import { formatNumber } from '@/shared/lib/format-number';
import {
  usePlannerStore,
  selectTreeAbisso,
  selectTreeCritChance,
  selectTreeCritDmg,
  selectTreeDanoTotal,
  selectTreeEnergy,
  selectTreeGlassCannon,
  selectTreeSpeed,
  selectTreeTeamCoinPct,
  selectTreeTempoDobrado,
} from '@/shared/stores';
import {
  accountKeystoneControlClass,
  accountKeystoneStatusClass,
  accountStackAlignClass,
  accountTreeValueClass,
} from '@bombfarm/ui/panel-field.recipe';

export function AccountTreeFields() {
  const { t } = useAppLang();
  const treeDanoTotal = usePlannerStore(selectTreeDanoTotal);
  const treeCritChance = usePlannerStore(selectTreeCritChance);
  const treeCritDmg = usePlannerStore(selectTreeCritDmg);
  const treeSpeed = usePlannerStore(selectTreeSpeed);
  const treeEnergy = usePlannerStore(selectTreeEnergy);
  const treeTeamCoinPct = usePlannerStore(selectTreeTeamCoinPct);
  const treeGlassCannon = usePlannerStore(selectTreeGlassCannon);
  const treeTempoDobrado = usePlannerStore(selectTreeTempoDobrado);
  const treeAbisso = usePlannerStore(selectTreeAbisso);
  const setTreeGlassCannon = usePlannerStore((state) => state.setTreeGlassCannon);
  const setTreeTempoDobrado = usePlannerStore((state) => state.setTreeTempoDobrado);
  const setTreeAbisso = usePlannerStore((state) => state.setTreeAbisso);

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
      <label>
        <span>
          {t.treeAbisso}
          <span data-field-hint>{t.treeAbissoHint}</span>
        </span>
        <div data-keystone-control className={accountKeystoneControlClass}>
          <span className={accountKeystoneStatusClass} aria-hidden>
            {treeAbisso ? t.keystoneOn : t.keystoneOff}
          </span>
          <Switch checked={treeAbisso} onCheckedChange={setTreeAbisso} aria-label={t.treeAbisso} />
        </div>
      </label>
      <label>
        <span>
          {t.treeGlassCannon}
          <span data-field-hint>{t.treeGlassCannonHint}</span>
        </span>
        <div data-keystone-control className={accountKeystoneControlClass}>
          <span className={accountKeystoneStatusClass} aria-hidden>
            {treeGlassCannon ? t.keystoneOn : t.keystoneOff}
          </span>
          <Switch
            checked={treeGlassCannon}
            onCheckedChange={setTreeGlassCannon}
            aria-label={t.treeGlassCannon}
          />
        </div>
      </label>
      <label>
        <span>
          {t.treeTempoDobrado}
          <span data-field-hint>{t.treeTempoDobradoHint}</span>
        </span>
        <div data-keystone-control className={accountKeystoneControlClass}>
          <span className={accountKeystoneStatusClass} aria-hidden>
            {treeTempoDobrado ? t.keystoneOn : t.keystoneOff}
          </span>
          <Switch
            checked={treeTempoDobrado}
            onCheckedChange={setTreeTempoDobrado}
            aria-label={t.treeTempoDobrado}
          />
        </div>
      </label>
    </Fields>
  );
}
