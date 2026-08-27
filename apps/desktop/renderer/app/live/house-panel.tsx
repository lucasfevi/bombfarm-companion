import { Panel, PanelHeader, StatList } from '@bombfarm/ui';
import type { RotationHousePanel } from '@bombfarm/domain/rotation-status';
import { sub, useCopy, useLocale } from '../../lib/copy';
import { formatCount } from '../../lib/format';
import { formatLiveDurationSeconds } from './format-live-duration';

function isHouseAbsent(house: RotationHousePanel): boolean {
  return (
    house.activeHouseIndex === undefined &&
    house.activeHouseLevel === undefined &&
    house.slots === undefined &&
    house.cycleSeconds === undefined &&
    house.rescuesLeft === undefined &&
    house.rescuesMax === undefined
  );
}

export function HousePanel({ house }: { house: RotationHousePanel }) {
  const t = useCopy();
  const { locale } = useLocale();

  if (isHouseAbsent(house)) {
    return (
      <Panel data-testid="live-house">
        <PanelHeader title={t.liveHouseTitle} />
        <p className="m-0 text-sm text-muted">{t.liveHouseAbsent}</p>
      </Panel>
    );
  }

  const rescuesValue =
    house.rescuesLeft !== undefined && house.rescuesMax !== undefined
      ? sub(t.liveHouseRescuesValue, {
          left: formatCount(house.rescuesLeft, locale),
          max: formatCount(house.rescuesMax, locale),
        })
      : t.fidelityStatusMissing;

  return (
    <Panel data-testid="live-house">
      <PanelHeader title={t.liveHouseTitle} />
      <StatList
        aria-label={t.liveHouseTitle}
        items={[
          {
            id: 'active',
            label: t.liveHouseActiveLabel,
            value: house.activeHouseIndex !== undefined ? formatCount(house.activeHouseIndex, locale) : t.fidelityStatusMissing,
          },
          {
            id: 'level',
            label: t.liveHouseLevelLabel,
            value: house.activeHouseLevel !== undefined ? formatCount(house.activeHouseLevel, locale) : t.fidelityStatusMissing,
          },
          {
            id: 'slots',
            label: t.liveHouseSlotsLabel,
            value: house.slots !== undefined ? formatCount(house.slots, locale) : t.fidelityStatusMissing,
          },
          {
            id: 'cycle',
            label: t.liveHouseCycleLabel,
            value: house.cycleSeconds !== undefined ? formatLiveDurationSeconds(house.cycleSeconds) : t.fidelityStatusMissing,
          },
          { id: 'rescues', label: t.liveHouseRescuesLabel, value: rescuesValue },
        ]}
      />
    </Panel>
  );
}
