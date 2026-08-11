'use client';

import { houseRestSeconds, splitHouseRest } from '@bombfarm/domain/model';
import type { AccountImportData } from '@bombfarm/domain/import-save';
import { houseLabel } from '@bombfarm/domain/game-labels';
import { formatNumber } from '@/shared/lib/format-number';
import type { Lang, Strings } from '@/shared/i18n';
import {
  importAccountBlockClass,
  importAccountClass,
  importAccountGridClass,
  statListClass,
} from '@bombfarm/ui/panel-field.recipe';

export function ImportAccountSummary({
  accountData,
  t,
  lang,
}: {
  accountData: AccountImportData;
  t: Strings;
  lang: Lang;
}) {
  const house =
    accountData.houseIdx != null
      ? (() => {
          const rest = splitHouseRest(
            houseRestSeconds(accountData.houseIdx, accountData.houseLevel ?? 1),
          );
          return {
            name: houseLabel(accountData.houseIdx, lang) || `#${accountData.houseIdx + 1}`,
            level: accountData.houseLevel ?? 1,
            rest,
          };
        })()
      : null;

  return (
    <div className={importAccountClass}>
      <div className={importAccountGridClass}>
        {accountData.tree && (
          <section className={importAccountBlockClass} aria-label={t.panelTree}>
            <h3>{t.panelTree}</h3>
            <dl className={statListClass}>
              <div>
                <dt>{t.treeDano}</dt>
                <dd>×{formatNumber(accountData.tree.danoTotal, 3)}</dd>
              </div>
              <div>
                <dt>{t.treeCrit}</dt>
                <dd>+{formatNumber(accountData.tree.critChance, 2)}%</dd>
              </div>
              <div>
                <dt>{t.treeCritDmg}</dt>
                <dd>+{formatNumber(accountData.tree.critDmg, 2)}%</dd>
              </div>
              <div>
                <dt>{t.treeSpeed}</dt>
                <dd>+{formatNumber(accountData.tree.speed, 2)}%</dd>
              </div>
              <div>
                <dt>{t.treeEnergy}</dt>
                <dd>+{formatNumber(accountData.tree.energy, 2)}%</dd>
              </div>
              <div>
                <dt>{t.treeTeamCoin}</dt>
                <dd>+{formatNumber(accountData.tree.teamCoinPct ?? 0, 2)}%</dd>
              </div>
              {accountData.tree.abisso && (
                <div>
                  <dt>{t.treeAbisso}</dt>
                  <dd>{t.importKeystoneOn}</dd>
                </div>
              )}
              {accountData.tree.glassCannon && (
                <div>
                  <dt>{t.treeGlassCannon}</dt>
                  <dd>{t.importKeystoneOn}</dd>
                </div>
              )}
              {accountData.tree.tempoDobrado && (
                <div>
                  <dt>{t.treeTempoDobrado}</dt>
                  <dd>{t.importKeystoneOn}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
        {house && (
          <section className={importAccountBlockClass} aria-label={t.house}>
            <h3>{t.house}</h3>
            <dl className={statListClass}>
              <div>
                <dt>{t.importHouseName}</dt>
                <dd>{house.name}</dd>
              </div>
              <div>
                <dt>{t.importHouseLevel}</dt>
                <dd>{house.level}</dd>
              </div>
              <div>
                <dt>{t.importHouseRest}</dt>
                <dd>
                  {house.rest.minutes} min {house.rest.seconds} s
                </dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}
