import type { TeamPlanObjective } from '@bombfarm/domain/team-plan/types';
import { formatCompactNumber, formatNumber } from '@bombfarm/ui';
import type { Lang } from '@bombfarm/hero/copy';

/**
 * How finely a plan's objective figures print. Gold and damage run to thousands and millions, so
 * they abbreviate; a set farm counts one set's item chests per hour, typically well under twenty,
 * where an abbreviated `0` or `0.4` would hide the whole gain.
 */
export type ObjectiveFigurePrecision = 'compact' | 'fine';

export function objectiveFigurePrecision(objective: TeamPlanObjective): ObjectiveFigurePrecision {
  return objective === 'setFarm' ? 'fine' : 'compact';
}

/** The figure as drawn, and the exact one its tooltip shows. */
export function formatObjectiveFigure(
  value: number,
  lang: Lang,
  precision: ObjectiveFigurePrecision,
  options: { signed?: boolean; decimals?: number } = {},
): { shown: string; exact: string } {
  const sign = options.signed === true && value >= 0 ? '+' : '';
  if (precision === 'fine') {
    return { shown: `${sign}${formatNumber(value, lang, 2)}`, exact: `${sign}${formatNumber(value, lang, 3)}` };
  }
  return {
    shown: `${sign}${formatCompactNumber(value, lang, options.decimals ?? 1)}`,
    exact: `${sign}${formatNumber(value, lang, 0)}`,
  };
}
