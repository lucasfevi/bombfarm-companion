'use client';

import { SHEET_PANEL_KEYS, type SheetPanelKey } from '@bombfarm/domain/planner-constants';
import { BREAKDOWN_DERIVED_IDS, type PipelineFacts } from '@bombfarm/domain/stat-breakdown';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import { Panel } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui/panel-field.recipe';
import { EffectiveStatGroup } from './effective-stat-group';

/** Sheet Total (`adjusted`) vs combat-effective — skip rows the hero sheet already shows. */
const SHEET_COMBAT_DELTA_EPS = 1e-9;

function sheetKeysWithCombatDelta(facts: PipelineFacts): SheetPanelKey[] {
  return SHEET_PANEL_KEYS.filter((key) => {
    // Luck never reaches HeroSheet / combat mults — always equal to sheet Total.
    if (key === 'luck') return false;
    return Math.abs(facts.effective[key] - facts.adjusted[key]) > SHEET_COMBAT_DELTA_EPS;
  });
}

export function EffectiveStatsPanel({ facts }: { facts: PipelineFacts }) {
  const { t } = useAppLang();
  const combatSheetKeys = sheetKeysWithCombatDelta(facts);

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.panelEffective}</h2>
      </div>
      <p className={tipClass}>{t.effectiveTip}</p>
      {combatSheetKeys.length > 0 && (
        <EffectiveStatGroup
          t={t}
          formatNumber={formatNumber}
          facts={facts}
          title={t.bdGroupSheet}
          ids={combatSheetKeys}
        />
      )}
      <EffectiveStatGroup
        t={t}
        formatNumber={formatNumber}
        facts={facts}
        title={t.bdGroupDerived}
        ids={BREAKDOWN_DERIVED_IDS}
      />
    </Panel>
  );
}
