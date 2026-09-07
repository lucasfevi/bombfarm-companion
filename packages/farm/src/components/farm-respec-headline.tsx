'use client';

import type { FarmRespecResult } from '@bombfarm/domain/farm-optimize';
import { sub, type Lang } from '@bombfarm/hero/copy';
import type { FarmCopy } from '../copy';
import { formatGainPct } from '../model/farm-respec-format';

/**
 * The toolbar's headline: the gain, labelled a LOWER BOUND, and nothing else. The phase, the
 * respec cost and the payback all live in the panel's metric tiles a click away — restated here
 * they made a single line the player had to read four facts out of before deciding whether to
 * open the panel at all, which is the only decision this line supports.
 *
 * Only ever mounted by the toolbar when Tier 1 says there is something to say; this component
 * has no visibility logic of its own.
 */
export function FarmRespecHeadline({ t, lang, result }: { t: FarmCopy; lang: Lang; result: FarmRespecResult }) {
  return (
    <span data-testid="farm-respec-headline" className="text-[12px] font-bold text-accent">
      {sub(t.farmRespecHeadlineGain, { pct: formatGainPct(result.gainPct, lang) })}
    </span>
  );
}
