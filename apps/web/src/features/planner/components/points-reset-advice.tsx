'use client';

import type { ResetAdvice } from '@bombfarm/domain/advisor-tables';
import type { Strings } from '@/shared/i18n';
import { mutedClass } from '@bombfarm/ui/panel-field.recipe';
import { cn } from '@bombfarm/ui';
import { renderTemplateWithPct } from '../model/render-template-with-pct';

/**
 * `AC-06` — the Tier 1 gain line. Always mounted (`DEC-03`), toggling `invisible` +
 * `aria-hidden` on `resetAdvice.recommend` so the Points panel never reflows when a reset
 * starts (or stops) being worth it. Copy is the lower-bound form enforced by
 * `i18n-copy-contract.test.ts` — never a bare percentage, always naming Optimize build.
 */
export function PointsResetAdvice({
  t,
  resetAdvice,
  formatNumber,
}: {
  t: Strings;
  resetAdvice: ResetAdvice;
  formatNumber: (n: number, d?: number) => string;
}) {
  const show = resetAdvice.recommend;
  return (
    <p className={cn(mutedClass, 'mb-2', !show && 'invisible')} aria-hidden={!show}>
      {renderTemplateWithPct(t.resetAdviceGainLine, formatNumber(resetAdvice.gainPct, 1))}
    </p>
  );
}
