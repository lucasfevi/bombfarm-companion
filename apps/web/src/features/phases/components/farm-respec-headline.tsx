'use client';

import type { Lang } from '@/shared/i18n';

import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import { sub, type Strings } from '@/shared/i18n';
import { formatGainPct } from '@/features/phases/model/farm-respec-format';

/**
 * The toolbar's headline: the gain, labelled a LOWER BOUND, and nothing else. The phase, the
 * respec cost and the payback all live in the panel's metric tiles a click away — restated here
 * they made a single line the player had to read four facts out of before deciding whether to
 * open the panel at all, which is the only decision this line supports.
 *
 * Only ever mounted by the toolbar when Tier 1 says there is something to say; this component
 * has no visibility logic of its own.
 */
export function FarmRespecHeadline({ t, lang, result }: { t: Strings; lang: Lang; result: FarmRespecResult }) {
  return (
    <span data-testid="farm-respec-headline" className="text-[12px] font-bold text-accent">
      {sub(t.farmRespecHeadlineGain, { pct: formatGainPct(result.gainPct, lang) })}
    </span>
  );
}
