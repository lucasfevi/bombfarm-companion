'use client';

import { Panel, StatList } from '@bombfarm/ui';
import {
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui/panel-field.recipe';
import { useAppLang } from '@/shared/context/app-lang';
import { sub } from '@/shared/i18n';
import { formatNumber } from '@/shared/lib/format-number';
import { formatClearTime } from '../model/phases-page';
import type { HeroRecord } from '@/shared/lib/storage';
import type { RosterDpsRow } from '@bombfarm/domain/roster-dps';
import { PhasesTop9Table } from './phases-top9-table';

export function PhasesSquadPanel({
  topSquadRows,
  slots,
  heroesById,
  activeHeroId,
  squadDps,
  clearSecs,
  onSelectHero,
}: {
  topSquadRows: RosterDpsRow[];
  /** FIELD concurrency cap the squad was ranked against — not the House recovery number. */
  slots: number;
  heroesById: Map<string, HeroRecord>;
  activeHeroId: string;
  squadDps: number;
  clearSecs: number | null;
  onSelectHero: (h: HeroRecord) => void;
}) {
  const { t } = useAppLang();

  return (
    <Panel className="min-w-0">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>
          {sub(t.phasesSquadSection, { slots: String(slots) })}
        </h2>
      </div>
      <p className={tipClass}>{t.phasesSquadTip}</p>
      <StatList
        items={[
          {
            id: 'squadDps',
            label: t.phasesSquadCombinedDps,
            value: formatNumber(squadDps, 0),
          },
          {
            id: 'clear',
            label: t.phasesClearEstimate,
            value: formatClearTime(clearSecs),
            tip: t.phasesClearDisclaimer,
          },
        ]}
      />
      {topSquadRows.length > 0 ? (
        <PhasesTop9Table
          rows={topSquadRows}
          heroesById={heroesById}
          activeHeroId={activeHeroId}
          t={t}
          formatNumber={formatNumber}
          onSelectHero={onSelectHero}
        />
      ) : null}
    </Panel>
  );
}
