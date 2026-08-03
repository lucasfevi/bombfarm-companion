'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { Num, Switch } from '@bombfarm/ui';
import { Fields } from '@bombfarm/ui';
import {
  usePlannerStore,
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
  const setTreeDanoTotal = usePlannerStore((state) => state.setTreeDanoTotal);
  const setTreeCritChance = usePlannerStore((state) => state.setTreeCritChance);
  const setTreeCritDmg = usePlannerStore((state) => state.setTreeCritDmg);
  const setTreeSpeed = usePlannerStore((state) => state.setTreeSpeed);
  const setTreeEnergy = usePlannerStore((state) => state.setTreeEnergy);
  const setTreeTeamCoinPct = usePlannerStore((state) => state.setTreeTeamCoinPct);
  const setTreeGlassCannon = usePlannerStore((state) => state.setTreeGlassCannon);
  const setTreeTempoDobrado = usePlannerStore((state) => state.setTreeTempoDobrado);

  return (
    <Fields layout="stack" className={accountStackAlignClass}>
      <label>
        <span>{t.treeDano}</span>
        <Num value={treeDanoTotal} onChange={setTreeDanoTotal} step={0.001} decimals={3} />
      </label>
      <label>
        <span>{t.treeCrit}</span>
        <Num value={treeCritChance} onChange={setTreeCritChance} decimals={2} />
      </label>
      <label>
        <span>{t.treeCritDmg}</span>
        <Num value={treeCritDmg} onChange={setTreeCritDmg} decimals={2} />
      </label>
      <label>
        <span>{t.treeSpeed}</span>
        <Num value={treeSpeed} onChange={setTreeSpeed} decimals={2} />
      </label>
      <label>
        <span>{t.treeEnergy}</span>
        <Num value={treeEnergy} onChange={setTreeEnergy} decimals={2} />
      </label>
      <label>
        <span>
          {t.treeTeamCoin}
          <span data-field-hint>{t.treeTeamCoinHint}</span>
        </span>
        <Num value={treeTeamCoinPct} onChange={setTreeTeamCoinPct} decimals={2} />
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
