'use client';

import { useMemo } from 'react';

import { Panel, StatList } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, phasesBoardEconomyClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { numberFormatterFor } from '@/shared/lib/format-number';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { economyItems } from '../model/phase-fact-items';

export function PhaseEconomyPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useAppLang();
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);

  return (
    <Panel className={phasesBoardEconomyClass}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesEconomy}</h2>
      </div>
      <StatList variant="phases" items={economyItems(intel, t, boundFormatNumber)} />
    </Panel>
  );
}
