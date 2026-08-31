'use client';

import { useMemo } from 'react';

import {
  Panel,
  StatList,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  phasesBoardEconomyClass,
} from '@bombfarm/ui';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { economyItems } from '../model/phase-fact-items';
import { useFarmCopy } from './farm-copy-context';

export function PhaseEconomyPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useFarmCopy();
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
