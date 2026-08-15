'use client';

import { formatCompactNumber, formatNumber } from '@/shared/lib/format-number';
import { useAppLang } from '@/shared/context/app-lang';
import { cn } from '@bombfarm/ui';
import { usePlannerStore, selectAdvisorPipeline } from '@/shared/stores';

const metricLabelClass = 'text-[9px] font-bold leading-none tracking-[0.08em] text-muted uppercase';
const metricValueClass = 'font-mono text-sm font-semibold leading-none tabular-nums';
const metricEmClass = 'font-mono text-[10px] leading-none not-italic';
const railDividerClass = 'border-line';

export function HeroStripMetrics() {
  const { t } = useAppLang();
  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const { dps, active, uptime, predHit, best } = pipeline;
  const bestStat = best.stat;
  const bestGainPct = best.gainPct;
  const fmtCompact = (value: number) => formatCompactNumber(value, 1);

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 border-b px-2.5 py-1.5 xl:border-r xl:border-b-0',
        railDividerClass,
      )}
    >
      <div className="flex min-w-13 flex-col gap-0.5">
        <span className={metricLabelClass}>{t.metricSustained}</span>
        <strong className={metricValueClass} title={formatNumber(dps, 0)}>
          {fmtCompact(dps)}
        </strong>
      </div>
      <div className="flex min-w-13 flex-col gap-0.5">
        <span className={metricLabelClass}>{t.metricActive}</span>
        <strong className={metricValueClass} title={formatNumber(active, 0)}>
          {fmtCompact(active)}
        </strong>
      </div>
      <div className="flex min-w-13 flex-col gap-0.5">
        <span className={metricLabelClass}>{t.metricUptime}</span>
        <strong className={metricValueClass}>{formatNumber(uptime, 1)}%</strong>
      </div>
      <div className="flex min-w-14 flex-col gap-0.5">
        <span className={metricLabelClass}>{t.metricNextPoint}</span>
        <strong className={cn(metricValueClass, 'text-accent')}>{t.statFull[bestStat]}</strong>
        <em className={metricEmClass}>+{formatNumber(bestGainPct, 1)}%</em>
      </div>
      <div className="flex min-w-13 flex-col gap-0.5">
        <span className={metricLabelClass}>{t.metricHit}</span>
        <strong className={metricValueClass} title={formatNumber(predHit, 0)}>
          {fmtCompact(predHit)}
        </strong>
      </div>
    </div>
  );
}
