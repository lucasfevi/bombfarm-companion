'use client';

import { useAppLang } from '@/shared/context/app-lang';
import { Fields, ReadonlyNum, Switch } from '@bombfarm/ui';
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
  const setTreeGlassCannon = usePlannerStore((state) => state.setTreeGlassCannon);
  const setTreeTempoDobrado = usePlannerStore((state) => state.setTreeTempoDobrado);

  return (
    <Fields layout="stack" className={accountStackAlignClass}>
      <label>
        <span>{t.treeDano}</span>
        <ReadonlyNum value={treeDanoTotal} decimals={3} />
      </label>
      <label>
        <span>{t.treeCrit}</span>
        <ReadonlyNum value={treeCritChance} decimals={2} />
      </label>
      <label>
        <span>{t.treeCritDmg}</span>
        <ReadonlyNum value={treeCritDmg} decimals={2} />
      </label>
      <label>
        <span>{t.treeSpeed}</span>
        <ReadonlyNum value={treeSpeed} decimals={2} />
      </label>
      <label>
        <span>{t.treeEnergy}</span>
        <ReadonlyNum value={treeEnergy} decimals={2} />
      </label>
      <label>
        <span>
          {t.treeTeamCoin}
          <span data-field-hint>{t.treeTeamCoinHint}</span>
        </span>
        <ReadonlyNum value={treeTeamCoinPct} decimals={2} />
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
