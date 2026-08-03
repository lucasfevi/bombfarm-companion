'use client';

import { type RankMode } from '@bombfarm/domain/model';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import { usePlannerStore, selectAdvisorPipeline } from '@/shared/stores';
import { Bar, Panel, Select } from '@bombfarm/ui';
import {
  barRowClass,
  panelHClass,
  panelTitleClass,
  rankModeSelectClass,
} from '@bombfarm/ui/panel-field.recipe';

export function NextPointRanking() {
  const { t } = useAppLang();
  const rankMode = usePlannerStore((state) => state.rankMode);
  const setRankMode = usePlannerStore((state) => state.setRankMode);
  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const { ranking, best } = pipeline;

  const onRankMode = setRankMode;

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.metricNextPoint}</h2>
        <Select
          size="compact"
          className={rankModeSelectClass}
          aria-label={t.metricNextPoint}
          value={rankMode}
          onChange={(event) => onRankMode(event.target.value as RankMode)}
        >
          <option value="dps">{t.modeDps}</option>
          <option value="oneshot">{t.modeOneshot}</option>
        </Select>
      </div>
      {ranking.map((row) => (
        <div className={barRowClass} key={row.stat}>
          <span>{t.statFull[row.stat]}</span>
          <Bar
            percent={Math.max((row.dpsGainPct / Math.max(best.dpsGainPct, 0.01)) * 100, 2)}
            variant={row === best ? 'best' : 'fill'}
          />
          <b>+{formatNumber(row.dpsGainPct, 1)}%</b>
        </div>
      ))}
    </Panel>
  );
}
