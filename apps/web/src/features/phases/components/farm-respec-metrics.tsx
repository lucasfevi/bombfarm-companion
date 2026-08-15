'use client';

import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import { sub, type Strings } from '@/shared/i18n';
import { GoldValue } from '@/shared/game-art';
import { formatRate } from '@/features/phases/model/farm-ranking-format';
import { resolvePaybackKind } from '@/features/phases/model/farm-respec-view';
import { formatGold, formatHours } from '@/features/phases/model/farm-respec-format';

/**
 * The four metric tiles — gold/hr, chests/hr, respec cost, payback — each current -> proposed
 * where the result carries both. The gold tile renders WHATEVER the objective is (item A
 * returns both rates unconditionally for exactly this) and carries a second line naming the
 * gold given up when the proposed build earns less of it.
 */
export function FarmRespecMetrics({ t, result }: { t: Strings; result: FarmRespecResult }) {
  const paybackKind = resolvePaybackKind(result);
  const paybackText =
    paybackKind === 'hours'
      ? sub(t.farmRespecPaybackHours, { hours: formatHours(result.paybackHours ?? 0) })
      : paybackKind === 'no-gold-gain'
        ? t.farmRespecPaybackNoGoldGain
        : t.farmRespecPaybackNoChange;
  const goldGivenUp = result.proposedGoldPerHour < result.currentGoldPerHour;

  return (
    <div
      data-testid="farm-respec-metrics"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      <div data-testid="farm-respec-metric-gold" className="rounded-sm border border-line p-2">
        <div className="text-[10px] tracking-[0.03em] text-muted uppercase">
          {t.farmRespecMetricGold}
        </div>
        <div className="text-[13px] font-bold">
          {formatRate(result.currentGoldPerHour)} → {formatRate(result.proposedGoldPerHour)}
        </div>
        {goldGivenUp ? (
          <div className="mt-0.5 text-[10px] text-muted">
            <GoldValue>
              {sub(t.farmRespecGoldGivenUp, {
                gold: formatRate(result.currentGoldPerHour - result.proposedGoldPerHour),
              })}
            </GoldValue>
          </div>
        ) : null}
      </div>
      <div data-testid="farm-respec-metric-chests" className="rounded-sm border border-line p-2">
        <div className="text-[10px] tracking-[0.03em] text-muted uppercase">
          {t.farmRespecMetricChests}
        </div>
        <div className="text-[13px] font-bold">
          {formatRate(result.currentChestsPerHour)} → {formatRate(result.proposedChestsPerHour)}
        </div>
      </div>
      <div data-testid="farm-respec-metric-cost" className="rounded-sm border border-line p-2">
        <div className="text-[10px] tracking-[0.03em] text-muted uppercase">
          {t.farmRespecMetricCost}
        </div>
        <div className="text-[13px] font-bold">
          <GoldValue>{formatGold(result.respecCostGold)}</GoldValue>
        </div>
      </div>
      <div data-testid="farm-respec-metric-payback" className="rounded-sm border border-line p-2">
        <div className="text-[10px] tracking-[0.03em] text-muted uppercase">
          {t.farmRespecMetricPayback}
        </div>
        <div className="text-[13px] font-bold">{paybackText}</div>
      </div>
    </div>
  );
}
