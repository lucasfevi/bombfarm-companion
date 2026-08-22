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
import {
  accountStatListClass,
  heroAbilTitleClass,
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui/panel-field.recipe';
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

/** A signed duration, dropping the minutes part when the gap is under a minute. */
function restDeltaText(deltaSeconds: number): string {
  const sign = deltaSeconds < 0 ? '−' : '+';
  const { minutes, seconds } = splitHouseRest(Math.abs(deltaSeconds));
  return minutes === 0 ? `${sign}${seconds} s` : `${sign}${minutes} min ${seconds} s`;
}

/**
 * The upgrade delta, or `null` when there is none.
 *
 * `betterWhen` is which direction counts as an improvement, because the two rows disagree: a
 * SHORTER cycle is better, a LARGER slot count is better. A zero delta returns `null` rather than
 * rendering `+0` — Casa IV → Casa V adds no slots at all, and a green `+0` there would read as a
 * gain the upgrade does not give.
 */
function deltaTone(delta: number, betterWhen: 'lower' | 'higher'): string | null {
  if (delta === 0) return null;
  const isBetter = betterWhen === 'lower' ? delta < 0 : delta > 0;
  return isBetter ? 'text-up' : 'text-down';
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

  const currentItems: StatListItem[] = [
    { id: 'house', label: t.house, value: houseLabel(houseIdx, lang) },
    { id: 'level', label: t.houseLevelLabel, value: `${houseLevel} / ${HOUSE_MAX_LEVEL}` },
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

  let nextItems: StatListItem[] = [];
  if (hasNext) {
    // The NEXT house at level 1 — its base, which is what the game reports for a house the
    // account has not levelled yet. Read from the wiki-sourced table rather than the save: the
    // save only carries a countdown for houses this account owns.
    const nextRest = houseRestSeconds(nextIdx, 1);
    const nextSlots = CASA_SLOTS_PER_HOUSE[nextIdx] ?? slots;
    const restDelta = nextRest - Math.round(currentRest);
    const slotsDelta = nextSlots - slots;
    const restTone = deltaTone(restDelta, 'lower');
    const slotsTone = deltaTone(slotsDelta, 'higher');

    nextItems = [
      {
        id: 'next-cycle',
        label: t.accountHouseCycle,
        value: (
          <>
            {restText(nextRest)}
            {restTone ? (
              <span className={`ml-2 ${restTone}`}>{restDeltaText(restDelta)}</span>
            ) : null}
          </>
        ),
      },
      {
        id: 'next-slots',
        label: t.accountCasaSlots,
        value: (
          <>
            {nextSlots}
            {slotsTone ? (
              <span className={`ml-2 ${slotsTone}`}>
                {slotsDelta > 0 ? `+${slotsDelta}` : `−${Math.abs(slotsDelta)}`}
              </span>
            ) : null}
          </>
        ),
      },
    ];
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
      <StatList variant="phases" className={accountStatListClass} items={currentItems} />

      {hasNext ? (
        <div className="mt-3 border-t border-line pt-3">
          <h3 className={heroAbilTitleClass}>
            {sub(t.accountNextHouse, { house: houseLabel(nextIdx, lang) })}
          </h3>
          <StatList variant="phases" className={accountStatListClass} items={nextItems} />
        </div>
      ) : null}
    </Panel>
  );
}
