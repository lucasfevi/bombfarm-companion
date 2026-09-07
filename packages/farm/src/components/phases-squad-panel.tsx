'use client';

import { useMemo } from 'react';

import {
  Panel,
  StatList,
  formatNumber,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui';
import type { HeroRecord } from '@bombfarm/domain/shims/storage';
import type { RosterDpsRow } from '@bombfarm/domain/roster-dps';
import { sub } from '@bombfarm/hero/copy';
import { formatClearTime } from '@bombfarm/hero/model';
import { useFarmCopy } from './farm-copy-context';
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
  const { t, lang } = useFarmCopy();
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);

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
            value: formatNumber(squadDps, lang, 0),
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
          formatNumber={boundFormatNumber}
          onSelectHero={onSelectHero}
        />
      ) : null}
    </Panel>
  );
}
