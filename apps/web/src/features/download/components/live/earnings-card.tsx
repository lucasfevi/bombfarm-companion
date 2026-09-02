import { Panel, formatCompactNumber, formatNumber } from '@bombfarm/ui';
import { sub, type Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import type { ReplicaDensity, ReplicaFrame } from '../../model/live-replica-data';
import { ReplicaBlock } from './replica-block';
import { ReplicaCardHead } from './replica-card-head';
import { ReplicaFigure } from './replica-figure';
import { TrendLine } from './trend-line';

/**
 * The desktop draws this panel twice, and so does this file. The compact density is the second
 * Live window's earnings: no sparkline, no session totals, no elapsed clock and no reading against
 * the map's estimate — a recent-window headline and six figures, which is all a window that size
 * can carry.
 */
export function EarningsCard({
  lang,
  earnings,
  measured,
  density = 'full',
}: {
  lang: Lang;
  earnings: ReplicaFrame['earnings'];
  measured: ReplicaFrame['measured'];
  density?: ReplicaDensity;
}) {
  const compact = (value: number) => formatCompactNumber(value, lang);

  if (density === 'compact') {
    return (
      <Panel className="flex w-80 max-w-full shrink-0 flex-col gap-2 p-2">
        <div className="flex items-end justify-between gap-2">
          <span className="flex min-w-0 flex-col items-start gap-0.5">
            <span className="text-[10px] whitespace-nowrap text-muted tabular-nums">
              {sub(liveLabel('liveEarningsRecentWindowLabel', lang), {
                minutes: earnings.seriesMinutes,
              })}
            </span>
            <span className="text-[20px] leading-none font-bold text-gold tabular-nums">
              {compact(earnings.goldPerHour)}
            </span>
            <span className="text-[10px] text-muted">
              {liveLabel('liveEarningsGoldHeadlineUnit', lang)}
            </span>
          </span>
          <span className="flex min-w-0 flex-col items-end gap-0.5">
            <span className="text-[10px] text-muted">
              {liveLabel('liveEarningsXpHeadlineUnit', lang)}
            </span>
            <span className="text-[16px] leading-none font-bold text-info tabular-nums">
              {compact(earnings.xpPerHour)}
            </span>
          </span>
        </div>
        <div className="grid grid-cols-3 gap-x-3 gap-y-2 border-t border-line/55 pt-2">
          <ReplicaFigure
            label={liveLabel('liveEarningsCurrentGoldLabel', lang)}
            value={compact(earnings.currentGold)}
            valueClass="text-gold"
          />
          <ReplicaFigure
            label={liveLabel('liveEarningsGoldSessionLabel', lang)}
            value={compact(earnings.goldSession)}
            valueClass="text-gold/70"
          />
          <ReplicaFigure
            label={liveLabel('liveEarningsXpSessionLabel', lang)}
            value={compact(earnings.xpSession)}
            valueClass="text-info/70"
          />
          <ReplicaFigure
            label={liveLabel('liveEarningsGoldPerPropLabel', lang)}
            value={formatNumber(measured.goldPerProp, lang, 0)}
            valueClass="text-gold"
          />
          <ReplicaFigure
            label={liveLabel('liveEarningsPropsPerMinuteLabel', lang)}
            value={formatNumber(measured.propsPerMinute, lang, 0)}
            valueClass="text-ink"
          />
          <ReplicaFigure
            label={liveLabel('liveEarningsPropsTotalLabel', lang)}
            value={formatCompactNumber(measured.propsSession, lang)}
            valueClass="text-ink"
          />
        </div>
      </Panel>
    );
  }

  const peak = Math.max(...earnings.goldSeries);

  return (
    <Panel className="flex flex-col p-3">
      <ReplicaCardHead title={liveLabel('liveEarningsTitle', lang)} />
      {/* Values right-aligned against their units, so the gold and XP rates line up on the digit
          edge instead of drifting apart with the smaller of the two. */}
      <div className="mb-3 grid grid-cols-[max-content_max-content] items-baseline gap-x-2">
        <span className="text-right text-[26px] leading-none font-bold text-gold tabular-nums">
          {compact(earnings.goldPerHour)}
        </span>
        <span className="text-[10px] text-muted">
          {liveLabel('liveEarningsGoldHeadlineUnit', lang)}
        </span>
        <span className="text-right text-[18px] leading-none font-bold text-info tabular-nums">
          {compact(earnings.xpPerHour)}
        </span>
        <span className="text-[10px] text-muted">
          {liveLabel('liveEarningsXpHeadlineUnit', lang)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ReplicaBlock
          label={liveLabel('liveEarningsCurrentGoldLabel', lang)}
          value={compact(earnings.currentGold)}
          valueClass="text-ink"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsGoldSessionLabel', lang)}
          value={compact(earnings.goldSession)}
          valueClass="text-gold/70"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsGoldSessionTotalLabel', lang)}
          value={compact(earnings.goldSessionTotal)}
          valueClass="text-gold"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsElapsedLabel', lang)}
          value={earnings.elapsed}
          valueClass="text-ink"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsXpSessionLabel', lang)}
          value={compact(earnings.xpSession)}
          valueClass="text-info/70"
        />
        <ReplicaBlock
          label={liveLabel('liveEarningsXpSessionTotalLabel', lang)}
          value={compact(earnings.xpSessionTotal)}
          valueClass="text-info"
        />
      </div>

      <div className="mt-3 flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] tracking-wide text-muted uppercase">
            {sub(liveLabel('liveEarningsSeriesLabel', lang), { minutes: earnings.seriesMinutes })}
          </span>
          <span className="font-mono text-[9.5px] text-muted tabular-nums">
            {sub(liveLabel('liveEarningsSeriesPeakLabel', lang), { value: compact(peak) })}
          </span>
        </div>
        <TrendLine series={earnings.goldSeries} />
      </div>

      {/* The measured counterpart to the map card's three estimates, one panel over — the same
          arrangement the desktop uses, so gold per prop can be read against its estimate. */}
      <div className="mt-3 flex flex-col gap-2 border-t border-line/55 pt-3">
        <span className="self-start text-[10px] tracking-wide text-muted uppercase">
          {liveLabel('liveEarningsMeasuredNote', lang)}
        </span>
        <div className="grid grid-cols-3 gap-3">
          <ReplicaFigure
            label={liveLabel('liveEarningsGoldPerPropLabel', lang)}
            value={formatNumber(measured.goldPerProp, lang, 0)}
            note={sub(liveLabel('liveEarningsGoldPerPropUnder', lang), {
              percent: formatNumber(Math.abs(measured.goldPerPropDeltaPercent), lang),
            })}
            valueClass="text-gold"
          />
          <ReplicaFigure
            label={liveLabel('liveEarningsPropsPerMinuteLabel', lang)}
            value={formatNumber(measured.propsPerMinute, lang, 0)}
            valueClass="text-ink"
          />
          <ReplicaFigure
            label={liveLabel('liveEarningsPropsTotalLabel', lang)}
            value={formatCompactNumber(measured.propsSession, lang)}
            valueClass="text-ink"
          />
        </div>
      </div>
    </Panel>
  );
}
