'use client';

import { Panel, StatList } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, phasesBoardJaulaClass } from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { jaulaItems } from '../model/phase-fact-items';

export function PhaseJaulaPanel({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useAppLang();

  return (
    <Panel className={phasesBoardJaulaClass}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesJaulaSection}</h2>
      </div>
      <StatList variant="phases" items={jaulaItems(intel, t, formatNumber, lang)} />
    </Panel>
  );
}
