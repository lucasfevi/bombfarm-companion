import type { ReactNode } from 'react';
import { cn } from '@bombfarm/ui';

/**
 * Renders `template` with `{pct}` (or `{pct}%`) replaced by a bold, "up"-styled value.
 * Keeps the trailing `%` from the template outside the emphasis when `{pct}%` is used.
 *
 * Callers only reach this when `gainPct > GAIN_EPS` (`optimizeResultDisplay`) or
 * `resetAdvice.recommend` is true (`PointsResetAdvice`, gain ≥ the 1% reset-gate floor) — the
 * 'down'/'neutral' tones this used to support were unreachable in practice, so the tone
 * parameter was dropped rather than kept unused.
 */
export function renderTemplateWithPct(template: string, pct: string): ReactNode {
  const withPctUnit = template.indexOf('{pct}%');
  const marker = withPctUnit >= 0 ? '{pct}%' : '{pct}';
  const index = template.indexOf(marker);
  if (index < 0) return template;
  const before = template.slice(0, index);
  const after = template.slice(index + marker.length);
  const emphasized = withPctUnit >= 0 ? `${pct}%` : pct;
  return (
    <>
      {before}
      <strong className={cn('font-semibold tabular-nums', 'text-up')}>{emphasized}</strong>
      {after}
    </>
  );
}
