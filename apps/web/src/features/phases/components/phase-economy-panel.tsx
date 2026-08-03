'use client';

import { Panel, StatList } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, phasesBoardEconomyClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { economyItems } from '../model/phase-fact-items';

export function PhaseEconomyPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t } = useAppLang();

  return (
    <Panel className={phasesBoardEconomyClass}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesEconomy}</h2>
      </div>
      <StatList variant="phases" items={economyItems(intel, t, formatNumber)} />
    </Panel>
  );
}
