'use client';

import { resolveHouseRestSeconds, splitHouseRest } from '@bombfarm/domain/model';
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
          const level = accountData.houseLevel ?? 1;
          // Same resolver the model uses — preferring the save's own `casa.cycle_secs` for the
          // house/level THIS import itself recorded (the anchor and the request are the same
          // pair here, since this panel only ever shows the account's own imported House, never
          // a picker that could have moved elsewhere).
          const rest = splitHouseRest(
            resolveHouseRestSeconds(
              accountData.houseCycleSecs,
              accountData.houseIdx,
              level,
              accountData.houseIdx,
              level,
            ),
          );
          return {
            name: houseLabel(accountData.houseIdx, lang) || `#${accountData.houseIdx + 1}`,
            level,
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
                <dd>×{formatNumber(accountData.tree.danoTotal, lang, 3)}</dd>
              </div>
              <div>
                <dt>{t.treeCrit}</dt>
                <dd>+{formatNumber(accountData.tree.critChance, lang, 2)}%</dd>
              </div>
              <div>
                <dt>{t.treeCritDmg}</dt>
                <dd>+{formatNumber(accountData.tree.critDmg, lang, 2)}%</dd>
              </div>
              <div>
                <dt>{t.treeSpeed}</dt>
                <dd>+{formatNumber(accountData.tree.speed, lang, 2)}%</dd>
              </div>
              <div>
                <dt>{t.treeEnergy}</dt>
                <dd>+{formatNumber(accountData.tree.energy, lang, 2)}%</dd>
              </div>
              <div>
                <dt>{t.treeTeamCoin}</dt>
                <dd>+{formatNumber(accountData.tree.teamCoinPct ?? 0, lang, 2)}%</dd>
              </div>
              <div>
                <dt>{t.treeXpMult}</dt>
                <dd>×{formatNumber(accountData.tree.xpMult ?? 1, lang, 2)}</dd>
              </div>
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
