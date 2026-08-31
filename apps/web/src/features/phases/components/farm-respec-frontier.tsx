'use client';

import type { Lang } from '@/shared/i18n';

import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import { sub, type Strings } from '@/shared/i18n';
import {
  resolveFrontierEntries,
  resolveFrontierHeroNames,
} from '@bombfarm/farm/model/farm-respec-view';
import { formatGainPct, formatGold, formatHours } from '@bombfarm/farm/model/farm-respec-format';

function heroCountLabel(strings: Strings, heroCount: number): string {
  return heroCount === 1
    ? strings.farmRespecFrontierHeroCountOne
    : strings.farmRespecFrontierHeroCountTwo;
}

/**
 * The cost frontier — cost-ascending, one row per entry, rendered in `result.frontier`'s OWN
 * order (item A guarantees the ordering; this file never sorts, filters or reverses it). Omitted
 * entirely when empty (a single searchable hero) rather than rendered as an empty list.
 */
export function FarmRespecFrontier({ t, lang, result }: { t: Strings; lang: Lang; result: FarmRespecResult }) {
  const entries = resolveFrontierEntries(result);
  if (entries == null) return null;

  return (
    <div data-testid="farm-respec-frontier" className="flex flex-col gap-1.5">
      <h4 className="m-0 text-[11px] tracking-[0.03em] text-muted uppercase">
        {t.farmRespecFrontierHeading}
      </h4>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {entries.map((entry) => (
          <li
            key={entry.heroCount}
            data-testid={`farm-respec-frontier-${entry.heroCount}`}
            className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]"
          >
            <span className="font-bold">{heroCountLabel(t, entry.heroCount)}</span>
            <span className="text-muted">
              {resolveFrontierHeroNames(entry).join(', ')}
            </span>
            <span>
              {sub(t.farmRespecFrontierGainCost, {
                gain: formatGainPct(entry.gainPct, lang),
                cost: formatGold(entry.respecCostGold, lang),
              })}
            </span>
            <span className="text-muted">
              {entry.paybackHours != null
                ? sub(t.farmRespecPaybackHours, { hours: formatHours(entry.paybackHours, lang) })
                : t.farmRespecFrontierPaybackNone}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
