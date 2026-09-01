'use client';

import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import { TipLabel, Tooltip } from '@bombfarm/ui';
import { GoldIcon, GoldValue, ChestIcon } from '@bombfarm/game-art';
import { sub, type FarmCopy, type Lang } from '../copy';
import { formatPhaseLabel, formatRate } from '../model/farm-ranking-format';
import { resolvePaybackKind, resolvePhaseChange } from '../model/farm-respec-view';
import { formatGold, formatHours, formatSignedPct } from '../model/farm-respec-format';

/**
 * The five metric tiles — gold/hr, chests/hr, recommended phase, respec cost, payback — each
 * current -> proposed where the result carries both.
 */
export function FarmRespecMetrics({
  t,
  lang,
  result,
}: {
  t: FarmCopy;
  lang: Lang;
  result: FarmRespecResult;
}) {
  const paybackKind = resolvePaybackKind(result);
  const paybackText =
    paybackKind === 'hours'
      ? sub(t.farmRespecPaybackHours, { hours: formatHours(result.paybackHours ?? 0, lang) })
      : t.farmRespecPaybackNoChange;
  const phaseChange = resolvePhaseChange(result);
  const phaseLabel = (phase: number | null) => (phase != null ? formatPhaseLabel(phase, lang) : '—');

  return (
    <div
      data-testid="farm-respec-metrics"
      className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
    >
      <div data-testid="farm-respec-metric-gold" className="rounded-sm border border-line p-2">
        <div className="flex items-center gap-1 text-[10px] tracking-[0.03em] text-muted uppercase">
          <GoldIcon className="size-3" />
          {t.farmRespecMetricGold}
        </div>
        <div className="text-[13px] font-bold">
          {formatRate(result.currentGoldPerHour, lang)} → {formatRate(result.proposedGoldPerHour, lang)}{' '}
          <span className="text-[10px] font-normal text-muted">
            ({formatSignedPct(result.goldGainPct, lang)}%)
          </span>
        </div>
      </div>
      <div data-testid="farm-respec-metric-chests" className="rounded-sm border border-line p-2">
        <div className="flex items-center gap-1 text-[10px] tracking-[0.03em] text-muted uppercase">
          <ChestIcon className="size-3" />
          {t.farmRespecMetricChests}
        </div>
        <div className="text-[13px] font-bold">
          {formatRate(result.currentChestsPerHour, lang)} → {formatRate(result.proposedChestsPerHour, lang)}{' '}
          <span className="text-[10px] font-normal text-muted">
            ({formatSignedPct(result.chestsGainPct, lang)}%)
          </span>
        </div>
      </div>
      <div data-testid="farm-respec-metric-phase" className="rounded-sm border border-line p-2">
        <div className="text-[10px] tracking-[0.03em] text-muted uppercase">
          {t.farmRespecMetricPhase}
        </div>
        <div className="text-[11px] font-bold text-wrap">
          {phaseChange.kind === 'same'
            ? phaseLabel(phaseChange.phase)
            : `${phaseLabel(result.currentPhase)} → ${phaseLabel(result.recommendedPhase)}`}
        </div>
        {phaseChange.kind === 'same' ? (
          <div className="mt-0.5 text-[10px] text-muted">{t.farmRespecMetricPhaseSame}</div>
        ) : null}
      </div>
      <div data-testid="farm-respec-metric-cost" className="rounded-sm border border-line p-2">
        <div className="text-[10px] tracking-[0.03em] text-muted uppercase">
          {t.farmRespecMetricCost}
        </div>
        <div className="text-[13px] font-bold">
          <GoldValue>{formatGold(result.respecCostGold, lang)}</GoldValue>
        </div>
      </div>
      <div data-testid="farm-respec-metric-payback" className="rounded-sm border border-line p-2">
        <Tooltip.Provider delay={180} closeDelay={80}>
          <div className="text-[10px] tracking-[0.03em] text-muted uppercase">
            <TipLabel
              label={t.farmRespecMetricPayback}
              tip={t.farmRespecPaybackTip}
              className="tracking-[0.03em] uppercase"
            />
          </div>
        </Tooltip.Provider>
        <div className="text-[13px] font-bold">{paybackText}</div>
      </div>
    </div>
  );
}
