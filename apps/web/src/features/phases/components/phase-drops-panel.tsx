'use client';

import { useMemo } from 'react';

import { Panel, StatList } from '@bombfarm/ui';
import {
  panelHClass,
  panelTitleClass,
  phasesBoardDropsClass,
  tipClass,
} from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { numberFormatterFor } from '@/shared/lib/format-number';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { dropItems } from '@bombfarm/farm/model/phase-fact-items';

export function PhaseDropsPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useAppLang();
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
