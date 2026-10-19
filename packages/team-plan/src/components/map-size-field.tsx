'use client';

import { isMapSize, type MapSize } from '@bombfarm/domain/model';
import { SegmentedToggle } from '@bombfarm/ui';
import type { TeamPlanCopy } from '../copy';
import { SetupField } from './setup-field';

export function MapSizeField({
  t,
  value,
  detected,
  onChange,
}: {
  t: TeamPlanCopy;
  value: MapSize;
  /** The map was read from the game rather than picked. */
  detected: boolean;
  onChange: (value: MapSize) => void;
}) {
  return (
    <SetupField
      label={t.teamPlanMapSizeLabel}
      hint={detected ? `${t.teamPlanMapSizeHint} ${t.teamPlanMapSizeHintDetected}` : t.teamPlanMapSizeHint}
      testId="team-plan-map-size"
    >
      <span className="flex h-[34px] items-center" data-map-size={value}>
        <SegmentedToggle
          ariaLabel={t.teamPlanMapSizeLabel}
          options={[
            { id: 'classic', label: t.teamPlanMapSizeClassic },
            { id: 'compact', label: t.teamPlanMapSizeCompact },
          ]}
          value={value}
          onChange={(id) => {
            if (isMapSize(id)) onChange(id);
          }}
        />
      </span>
    </SetupField>
  );
}
