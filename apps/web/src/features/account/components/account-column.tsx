'use client';

import {
  computeTeamBuffsFromDeployed,
  zeroTeamBuffs,
} from '@bombfarm/domain/team-buffs';
import { useAppLang } from '@/shared/context/app-lang';
import { Button, Panel } from '@bombfarm/ui';
import {
  usePlannerStore,
  selectHeroes,
} from '@/shared/stores';
import {
  accountBodyClass,
  accountSplitClass,
  accountSubHClass,
  heroAbilTitleClass,
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui/panel-field.recipe';
import { AccountHouseFields } from './account-house-fields';
import { AccountFarmTargetFields } from './account-farm-target-fields';
import { AccountTreeFields } from './account-tree-fields';
import { AccountTeamBuffFields } from './account-team-buff-fields';

export function AccountColumn() {
  const { t } = useAppLang();
  const heroes = usePlannerStore(selectHeroes);
  const setTeamBuffs = usePlannerStore((state) => state.setTeamBuffs);

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.panelAccount}</h2>
      </div>
      <p className={tipClass}>{t.accountTip}</p>

      <AccountHouseFields />

      <AccountFarmTargetFields />

      <div className={accountBodyClass}>
        <div className={`${accountSplitClass} mb-1.5`}>
          <div className={accountSubHClass}>
            <h3 className={heroAbilTitleClass}>{t.panelTree}</h3>
          </div>
          <div className={accountSubHClass}>
            <h3 className={heroAbilTitleClass}>{t.panelTeamBuffs}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                onClick={() => setTeamBuffs(computeTeamBuffsFromDeployed(heroes))}
              >
                {t.teamBuffsAutoFill}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setTeamBuffs(zeroTeamBuffs())}>
                {t.reset}
              </Button>
            </div>
          </div>
        </div>

        <div className={accountSplitClass}>
          <div className="min-w-0">
            <AccountTreeFields />
          </div>

          <div className="min-w-0">
            <AccountTeamBuffFields />
          </div>
        </div>
      </div>
    </Panel>
  );
}
