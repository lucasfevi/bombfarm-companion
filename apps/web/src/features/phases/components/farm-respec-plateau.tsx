'use client';

import type { FarmRespecPlateau as FarmRespecPlateauFacts } from '@bombfarm/domain/farm-optimize';
import { sub, type Strings } from '@/shared/i18n';
import { formatGainPct, formatSharePct } from '@/features/phases/model/farm-respec-format';

/**
 * The plateau in words. `min === max` renders the "sharp optimum" wording instead of a range —
 * the domain's real no-neighbour case, not an error.
 */
export function FarmRespecPlateau({ t, plateau }: { t: Strings; plateau: FarmRespecPlateauFacts }) {
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
      <p className="m-0 text-[11px] text-muted">{sentence}</p>
    </div>
  );
}
