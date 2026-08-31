import { Panel, formatCompactNumber, formatNumber } from '@bombfarm/ui';
import { sub, type Lang } from '@/shared/i18n';
import { liveLabel } from '../../model/live-replica-copy';
import type { ReplicaFrame } from '../../model/live-replica-data';
import { MeasuredFigure } from './measured-figure';
import { ReplicaBlock } from './replica-block';
import { ReplicaCardHead } from './replica-card-head';
import { TrendLine } from './trend-line';

export function EarningsCard({
  lang,
  earnings,
  measured,
}: {
  lang: Lang;
  earnings: ReplicaFrame['earnings'];
  measured: ReplicaFrame['measured'];
}) {
  const compact = (value: number) => formatCompactNumber(value, lang);
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
          <MeasuredFigure
            label={liveLabel('liveEarningsGoldPerPropLabel', lang)}
            value={formatNumber(measured.goldPerProp, lang, 0)}
            note={sub(liveLabel('liveEarningsGoldPerPropUnder', lang), {
              percent: formatNumber(Math.abs(measured.goldPerPropDeltaPercent), lang),
            })}
            valueClass="text-gold"
          />
          <MeasuredFigure
            label={liveLabel('liveEarningsPropsPerMinuteLabel', lang)}
            value={formatNumber(measured.propsPerMinute, lang, 0)}
            valueClass="text-ink"
          />
          <MeasuredFigure
            label={liveLabel('liveEarningsPropsTotalLabel', lang)}
            value={formatCompactNumber(measured.propsSession, lang)}
            valueClass="text-ink"
          />
        </div>
      </div>
    </Panel>
  );
}
