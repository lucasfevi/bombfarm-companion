'use client';

import type { FarmRespecPlateau as FarmRespecPlateauFacts } from '@bombfarm/domain/farm-optimize';
import { sub, type Strings } from '@/shared/i18n';
import { buildPlateauGeometry } from '@/features/phases/model/farm-respec-view';
import { formatGainPct, formatSharePct } from '@/features/phases/model/farm-respec-format';

/**
 * The plateau as a shaded band with current + proposed markers, plus the sentence that carries
 * the same numbers in words. The band is decorative (`aria-hidden`); the sentence IS
 * the accessible content. `min === max` renders the "sharp optimum" wording instead of a range —
 * the domain's real no-neighbour case, not an error.
 */
export function FarmRespecPlateau({ t, plateau }: { t: Strings; plateau: FarmRespecPlateauFacts }) {
  const geometry = buildPlateauGeometry(plateau);
  const sharp = plateau.minEnergyShare === plateau.maxEnergyShare;
  const sentence = sharp
    ? sub(t.farmRespecPlateauSharp, {
        value: formatSharePct(plateau.minEnergyShare),
        tolerance: formatGainPct(plateau.tolerancePct),
      })
    : sub(t.farmRespecPlateauRange, {
        min: formatSharePct(plateau.minEnergyShare),
        max: formatSharePct(plateau.maxEnergyShare),
        tolerance: formatGainPct(plateau.tolerancePct),
      });

  return (
    <div data-testid="farm-respec-plateau" className="flex flex-col gap-1.5">
      <div className="text-[10px] tracking-[0.03em] text-muted uppercase">
        {t.farmRespecPlateauLabel}
      </div>
      <div aria-hidden className="relative h-2 rounded-sm bg-bg-2">
        <div
          className="absolute top-0 h-full rounded-sm bg-accent/30"
          style={{ left: `${geometry.bandLeftPct}%`, width: `${geometry.bandWidthPct}%` }}
        />
        <div
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-line bg-bg-2"
          style={{ left: `${geometry.currentPct}%` }}
        />
        <div
          className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          style={{ left: `${geometry.proposedPct}%` }}
        />
      </div>
      <p className="m-0 text-[11px] text-muted">{sentence}</p>
    </div>
  );
}
