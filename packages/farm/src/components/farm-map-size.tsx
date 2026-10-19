'use client';

import { isMapSize, type MapSize } from '@bombfarm/domain/model';
import { InfoTip, SegmentedToggle } from '@bombfarm/ui';
import type { FarmCopy } from '../copy';
import { farmFieldClass, farmFieldControlClass, farmFieldLabelClass } from './farm-ranking-filters';

type Props = {
  mapSize: MapSize;
  onMapSizeChange: (mapSize: MapSize) => void;
  /** The map was read from the game rather than picked. */
  detected?: boolean;
  t: FarmCopy;
};

export function FarmMapSize({ mapSize, onMapSizeChange, detected = false, t }: Props) {
  const tip = detected ? `${t.farmRankingMapSizeTip} ${t.farmRankingMapSizeTipDetected}` : t.farmRankingMapSizeTip;
  return (
    <div className={farmFieldClass} data-testid="farm-map-size" data-map-size={mapSize}>
      <span className={farmFieldLabelClass}>
        {t.farmRankingMapSizeLabel}
        <InfoTip label={t.farmRankingMapSizeLabel} tip={tip} />
      </span>
      <div className={farmFieldControlClass}>
        <SegmentedToggle
          ariaLabel={t.farmRankingMapSizeLabel}
          options={[
            { id: 'classic', label: t.farmRankingMapSizeClassic },
            { id: 'compact', label: t.farmRankingMapSizeCompact },
          ]}
          value={mapSize}
          onChange={(id) => {
            if (isMapSize(id)) onMapSizeChange(id);
          }}
        />
      </div>
    </div>
  );
}
