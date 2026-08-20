'use client';

import { type RankMode } from '@bombfarm/domain/model';
import type { FarmPointRankOutcome } from '@bombfarm/domain/farm-point-rank';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import { usePlannerStore, selectNextPointRanking } from '@/shared/stores';
import type { Strings } from '@/shared/i18n';
import { Bar, Panel, Select } from '@bombfarm/ui';
import {
  barRowClass,
  panelHClass,
  panelTitleClass,
  rankModeSelectClass,
} from '@bombfarm/ui/panel-field.recipe';

/**
 * Signed, mode-neutral gain string. For a non-negative value this is byte-identical to the
 * DPS-only "+{n}%" the panel always rendered before farm mode existed — DPS gains are never
 * negative, so the sign branch below is only ever exercised under farm mode. Exported (with the
 * two helpers below) so the panel's rendering rules are directly unit-testable — this repo has
 * no DOM-rendering test idiom (no jsdom / @testing-library/react dependency; see
 * farm-ranking-board.test.ts's own note), so the logic that would otherwise only be provable by
 * rendering lives in plain, testable functions instead.
 */
export function formatSignedGainPct(value: number): string {
  const sign = value < 0 ? '−' : '+';
  return `${sign}${formatNumber(Math.abs(value), 1)}%`;
}

/** The bar's fill percent: floored at 2 (never invisible), and a negative farm gain contributes
 *  0 rather than a negative width. */
export function barPercent(gainPct: number, bestGainPct: number): number {
  return Math.max((Math.max(gainPct, 0) / Math.max(bestGainPct, 0.01)) * 100, 2);
}

/** emptyPool/heroNotInPool: no rotation to rank against at all. allDegenerate/noBaseline: a
 *  pool exists but nothing in it produces a usable rate. Two rendered notes, five outcomes. */
export function fallbackNoteText(outcome: FarmPointRankOutcome, strings: Strings): string {
  if (outcome === 'emptyPool' || outcome === 'heroNotInPool') return strings.rankFarmNoPool;
  return strings.rankFarmNoRate;
}

export function NextPointRanking() {
  const { t } = useAppLang();
  const rankMode = usePlannerStore((state) => state.rankMode);
  const setRankMode = usePlannerStore((state) => state.setRankMode);
  const { rows, fallback, addedToPool } = usePlannerStore(selectNextPointRanking);
  const best = rows[0];

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
          <option value="farm">{t.modeFarm}</option>
        </Select>
      </div>
      {rows.map((row) => (
        <div className={barRowClass} key={row.stat}>
          <span>{t.statFull[row.stat]}</span>
          <Bar
            percent={barPercent(row.gainPct, best.gainPct)}
            variant={row === best ? 'best' : 'fill'}
          />
          <b>{formatSignedGainPct(row.gainPct)}</b>
        </div>
      ))}
      {fallback != null ? (
        <p className="m-0 mt-1 text-[11px] text-muted">{fallbackNoteText(fallback, t)}</p>
      ) : addedToPool ? (
        <p className="m-0 mt-1 text-[11px] text-muted">{t.rankFarmAddedToPool}</p>
      ) : null}
    </Panel>
  );
}
