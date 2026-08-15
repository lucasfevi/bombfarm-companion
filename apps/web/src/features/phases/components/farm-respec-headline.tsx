'use client';

import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import { sub, type Lang, type Strings } from '@/shared/i18n';
import { formatPhaseLabel } from '@/features/phases/model/farm-ranking-format';
import { resolvePaybackKind } from '@/features/phases/model/farm-respec-view';
import { formatGainPct, formatGold, formatHours } from '@/features/phases/model/farm-respec-format';

/**
 * The toolbar's headline — gain % (a LOWER BOUND), recommended phase, respec cost and
 * payback in words. Only ever mounted by the toolbar when Tier 1 says there is something to say;
 * this component has no visibility logic of its own.
 */
export function FarmRespecHeadline({
  t,
  lang,
  result,
}: {
  t: Strings;
  lang: Lang;
  result: FarmRespecResult;
}) {
  const paybackKind = resolvePaybackKind(result);
  const paybackText =
    paybackKind === 'hours'
      ? sub(t.farmRespecPaybackHours, { hours: formatHours(result.paybackHours ?? 0) })
      : paybackKind === 'no-gold-gain'
        ? t.farmRespecPaybackNoGoldGain
        : t.farmRespecPaybackNoChange;

  return (
    <div
      data-testid="farm-respec-headline"
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[12px]"
    >
      <span className="font-bold text-accent">
        {sub(t.farmRespecHeadlineGain, { pct: formatGainPct(result.gainPct) })}
      </span>
      {result.recommendedPhase != null ? (
        <span className="text-muted">
          {t.farmRespecHeadlinePhase}: {formatPhaseLabel(result.recommendedPhase, lang)}
        </span>
      ) : null}
      <span className="text-muted">
        {sub(t.farmRespecHeadlineCost, { gold: formatGold(result.respecCostGold) })}
      </span>
      <span className="text-muted">{paybackText}</span>
    </div>
  );
}
