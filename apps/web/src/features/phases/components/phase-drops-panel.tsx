'use client';

import { Panel, StatList } from '@bombfarm/ui';
import {
  panelHClass,
  panelTitleClass,
  phasesBoardDropsClass,
  tipClass,
} from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { dropItems } from '../model/phase-fact-items';

export function PhaseDropsPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t } = useAppLang();

  return (
    <Panel className={phasesBoardDropsClass}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesDropsSection}</h2>
      </div>
      <p className={tipClass}>{t.phasesDropsSectionDesc}</p>
      <StatList variant="phases" items={dropItems(intel, t, formatNumber)} />
    </Panel>
  );
}
