'use client';

import { useMemo } from 'react';

import { Panel, StatList } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, phasesBoardMapClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { numberFormatterFor } from '@/shared/lib/format-number';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { mapFactItems } from '@bombfarm/farm/model/phase-fact-items';

export function PhaseMapFactsPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useAppLang();
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
