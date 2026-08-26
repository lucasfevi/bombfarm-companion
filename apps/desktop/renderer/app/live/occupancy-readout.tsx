import { Panel, PanelHeader } from '@bombfarm/ui';
import type { RotationOccupancy } from '@bombfarm/domain/rotation-status';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';

export function OccupancyReadout({ occupancy }: { occupancy: RotationOccupancy }) {
  const t = useCopy();
  const { locale } = useLocale();

  const value =
    occupancy.fieldSize !== undefined
      ? sub(t.liveOccupancyValue, {
          occupied: formatCount(occupancy.occupied, locale),
          total: formatCount(occupancy.fieldSize, locale),
        })
      : sub(t.liveOccupancyValueUnknownTotal, { occupied: formatCount(occupancy.occupied, locale) });

  return (
    <Panel data-testid="live-occupancy">
      <PanelHeader title={t.liveOccupancyLabel} />
      <p className="m-0 text-sm text-ink">{value}</p>
    </Panel>
  );
}
