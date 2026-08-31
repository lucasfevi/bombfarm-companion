'use client';

import { useMemo } from 'react';

import {
  Panel,
  StatList,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  phasesBoardMapClass,
} from '@bombfarm/ui';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { mapFactItems } from '../model/phase-fact-items';
import { useFarmCopy } from './farm-copy-context';

export function PhaseMapFactsPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useFarmCopy();
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);

  return (
    <Panel className={phasesBoardMapClass}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesMapFacts}</h2>
      </div>
      <StatList variant="phases" items={mapFactItems(intel, t, boundFormatNumber, lang)} />
    </Panel>
  );
}
