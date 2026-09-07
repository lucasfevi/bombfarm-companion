'use client';

import { type PointValue, type RankMode } from '@bombfarm/domain/model';
import type { FarmPointRankOutcome } from '@bombfarm/domain/farm-point-rank';
import {
  Bar,
  Panel,
  Select,
  barRowClass,
  formatNumber,
  panelHClass,
  panelTitleClass,
  rankModeSelectClass,
} from '@bombfarm/ui';
import type { Lang, StatPanelCopy } from '../copy';

/**
 * Signed, mode-neutral gain string. For a non-negative value this is byte-identical to the
 * DPS-only "+{n}%" the panel always rendered before farm mode existed — DPS gains are never
 * negative, so the sign branch below is only ever exercised under farm mode. Exported (with the
 * two helpers below) so the panel's rendering rules are directly unit-testable — this repo has
 * no DOM-rendering test idiom (no jsdom / @testing-library/react dependency; see
 * farm-ranking-board.test.ts's own note), so the logic that would otherwise only be provable by
 * rendering lives in plain, testable functions instead.
 */
export function formatSignedGainPct(value: number, lang: Lang): string {
  const sign = value < 0 ? '−' : '+';
  return `${sign}${formatNumber(Math.abs(value), lang, 1)}%`;
}

/** The bar's fill percent: floored at 2 (never invisible), and a negative farm gain contributes
 *  0 rather than a negative width. */
export function barPercent(gainPct: number, bestGainPct: number): number {
  return Math.max((Math.max(gainPct, 0) / Math.max(bestGainPct, 0.01)) * 100, 2);
}

/** emptyPool/heroNotInPool: no rotation to rank against at all. allDegenerate/noBaseline: a
 *  pool exists but nothing in it produces a usable rate. Two rendered notes, five outcomes. */
export function fallbackNoteText(outcome: FarmPointRankOutcome, strings: StatPanelCopy): string {
  if (outcome === 'emptyPool' || outcome === 'heroNotInPool') return strings.rankFarmNoPool;
  return strings.rankFarmNoRate;
}

/**
 * AN INPUT, NEVER COMPUTED HERE. The farm mode is scored against a rotation pool the host composes
 * above the per-hero pipeline — its enabled set, its live editor draft, its max phase — so ranking
 * from inside this package would drag that host state into a shared component.
 *
 * `fallback` is what makes a farm mode that could not be answered legible: it names the outcome and
 * `rows` still carries the damage ranking, so "farming was asked for and is unavailable, here is
 * why" is a different state from "the ranking is empty". A host cannot express the first by sending
 * no rows.
 */
export type NextPointRankingInput = {
  readonly rows: readonly PointValue[];
  readonly fallback: FarmPointRankOutcome | null;
  readonly addedToPool: boolean;
};

export function NextPointRanking({
  t,
  lang,
  ranking,
  rankMode,
  onRankMode,
}: {
  t: StatPanelCopy;
  lang: Lang;
  ranking: NextPointRankingInput;
  rankMode: RankMode;
  onRankMode: (next: RankMode) => void;
}) {
  const { rows, fallback, addedToPool } = ranking;
  const best = rows[0];

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
      {best &&
        rows.map((row) => (
          <div className={barRowClass} key={row.stat}>
            <span>{t.statFull[row.stat]}</span>
            <Bar
              percent={barPercent(row.gainPct, best.gainPct)}
              variant={row === best ? 'best' : 'fill'}
            />
            <b>{formatSignedGainPct(row.gainPct, lang)}</b>
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
