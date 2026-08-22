'use client';

import { CASA_SLOTS_PER_HOUSE } from '@bombfarm/domain/casa-slots';
import { houseLabel } from '@bombfarm/domain/game-labels';
import {
  HOUSES,
  HOUSE_MAX_LEVEL,
  houseRestSeconds,
  resolveHouseRestSeconds,
  splitHouseRest,
} from '@bombfarm/domain/model';
import { houseIconSrc } from '@bombfarm/domain/wiki-assets';
import { Panel, StatList, type StatListItem } from '@bombfarm/ui';
import { panelHClass, panelTitleClass, tipClass } from '@bombfarm/ui/panel-field.recipe';
import { HouseIcon } from '@/shared/game-art';
import { sub } from '@/shared/i18n';
import { useAppLang } from '@/shared/context/app-lang';
import {
  usePlannerStore,
  selectHouseCycleSecs,
  selectHouseCycleSecsHouseIdx,
  selectHouseCycleSecsLevel,
  selectHouseIdx,
  selectHouseLevel,
  selectSlots,
} from '@/shared/stores';

function restText(totalSeconds: number): string {
  const { minutes, seconds } = splitHouseRest(totalSeconds);
  return `${minutes} min ${seconds} s`;
}

export function AccountHousePanel() {
  const { t, lang } = useAppLang();
  const houseIdx = usePlannerStore(selectHouseIdx);
  const houseLevel = usePlannerStore(selectHouseLevel);
  const slots = usePlannerStore(selectSlots);
  const houseCycleSecs = usePlannerStore(selectHouseCycleSecs);
  const cycleHouseIdx = usePlannerStore(selectHouseCycleSecsHouseIdx);
  const cycleLevel = usePlannerStore(selectHouseCycleSecsLevel);

  // Same resolver the model uses (`farmContextForHero`), so this panel never contradicts the
  // DPS / farm-board / team-plan numbers it labels.
  const currentRest = resolveHouseRestSeconds(
    houseCycleSecs,
    houseIdx,
    houseLevel,
    cycleHouseIdx,
    cycleLevel,
  );

  const nextIdx = houseIdx + 1;
  const hasNext = nextIdx < HOUSES.length;

  const items: StatListItem[] = [
    {
      id: 'house',
      label: t.house,
      value: houseLabel(houseIdx, lang),
      icon: <HouseIcon houseIdx={houseIdx} />,
    },
    {
      id: 'level',
      label: t.houseLevelLabel,
      value: `${houseLevel} / ${HOUSE_MAX_LEVEL}`,
    },
    {
      id: 'cycle',
      label: t.accountHouseCycle,
      tip: t.accountHouseCycleTip,
      value: restText(currentRest),
    },
    {
      id: 'slots',
      label: t.accountCasaSlots,
      tip: t.accountCasaSlotsTip,
      value: slots,
    },
  ];

  if (hasNext) {
    // The NEXT house at level 1 — its base, which is what the game reports for a house the
    // account has not levelled yet. Read from the wiki-sourced table rather than the save: the
    // save only carries a countdown for houses this account owns.
    items.push(
      {
        id: 'next-house',
        label: t.accountNextHouse,
        tip: t.accountNextHouseTip,
        value: houseLabel(nextIdx, lang),
        icon: <HouseIcon houseIdx={nextIdx} />,
      },
      {
        id: 'next-cycle',
        label: sub(t.accountNextHouseCycle, { house: houseLabel(nextIdx, lang) }),
        value: restText(houseRestSeconds(nextIdx, 1)),
      },
      {
        id: 'next-slots',
        label: sub(t.accountNextHouseSlots, { house: houseLabel(nextIdx, lang) }),
        value: CASA_SLOTS_PER_HOUSE[nextIdx] ?? slots,
      },
    );
  }

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.panelHouse}</h2>
      </div>
      <img
        src={houseIconSrc(houseIdx)}
        alt=""
        aria-hidden
        draggable={false}
        className="mx-auto mb-2 h-20 w-auto object-contain"
      />
      <p className={tipClass}>{hasNext ? t.accountHouseTip : t.accountHouseTipMaxed}</p>
      <StatList variant="phases" items={items} />
    </Panel>
  );
}
