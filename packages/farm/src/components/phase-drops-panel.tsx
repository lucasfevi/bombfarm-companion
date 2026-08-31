'use client';

import { useMemo } from 'react';

import {
  Panel,
  StatList,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  phasesBoardDropsClass,
  tipClass,
} from '@bombfarm/ui';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { dropItems } from '../model/phase-fact-items';
import { useFarmCopy } from './farm-copy-context';

export function PhaseDropsPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useFarmCopy();
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);

  return (
    <Panel className={phasesBoardDropsClass}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesDropsSection}</h2>
      </div>
      <p className={tipClass}>{t.phasesDropsSectionDesc}</p>
      <StatList variant="phases" items={dropItems(intel, t, boundFormatNumber)} />
    </Panel>
  );
}
