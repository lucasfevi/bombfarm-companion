'use client';

import { Panel, StatList } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, phasesBoardMapClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { mapFactItems } from '../model/phase-fact-items';

export function PhaseMapFactsPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useAppLang();

  return (
    <Panel className={phasesBoardMapClass}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesMapFacts}</h2>
      </div>
      <StatList variant="phases" items={mapFactItems(intel, t, formatNumber, lang)} />
    </Panel>
  );
}
