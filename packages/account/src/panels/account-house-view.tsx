import { CASA_SLOTS_PER_HOUSE } from '@bombfarm/domain/casa-slots';
import { HOUSES, HOUSE_MAX_LEVEL, houseRestSeconds } from '@bombfarm/domain/model';
import { houseIconSrc } from '@bombfarm/domain/wiki-assets';
import {
  Panel,
  StatList,
  accountStatListClass,
  heroAbilTitleClass,
  panelHClass,
  panelTitleClass,
  tipClass,
  type StatListItem,
} from '@bombfarm/ui';

export interface AccountHouseLabels {
  title: string;
  tip: string;
  /** Shown instead of `tip` once the account owns the last House, which has nothing to upgrade to. */
  tipMaxed: string;
  house: string;
  level: string;
  cycle: string;
  cycleTip: string;
  slots: string;
  slotsTip: string;
  houseName: (houseIndex: number) => string;
  nextHouseHeading: (houseName: string) => string;
  levelOfMax: (level: number, maxLevel: number) => string;
  cycleDuration: (totalSeconds: number) => string;
  /** A signed duration — the view only asks for one when the gap is non-zero. */
  cycleDelta: (deltaSeconds: number) => string;
  slotsDelta: (delta: number) => string;
}

export interface AccountHouseViewProps {
  houseIndex: number;
  houseLevel: number;
  /** How many heroes this House recovers at a time. */
  slots: number;
  /** A full 0 → 100% House fill, already resolved against whatever countdown the account carries. */
  restSeconds: number;
  labels: AccountHouseLabels;
}

/**
 * The upgrade delta's tone, or `null` when there is none.
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

export function AccountHouseView({
  houseIndex,
  houseLevel,
  slots,
  restSeconds,
  labels,
}: AccountHouseViewProps) {
  const nextIndex = houseIndex + 1;
  const hasNext = nextIndex < HOUSES.length;

  const currentItems: StatListItem[] = [
    { id: 'house', label: labels.house, value: labels.houseName(houseIndex) },
    { id: 'level', label: labels.level, value: labels.levelOfMax(houseLevel, HOUSE_MAX_LEVEL) },
    {
      id: 'cycle',
      label: labels.cycle,
      tip: labels.cycleTip,
      value: labels.cycleDuration(restSeconds),
    },
    {
      id: 'slots',
      label: labels.slots,
      tip: labels.slotsTip,
      value: slots,
    },
  ];

  let nextItems: StatListItem[] = [];
  if (hasNext) {
    // The NEXT house at level 1 — its base, which is what the game reports for a house the
    // account has not levelled yet. Read from the wiki-sourced table rather than the account:
    // an account only carries a countdown for the houses it owns.
    const nextRest = houseRestSeconds(nextIndex, 1);
    const nextSlots = CASA_SLOTS_PER_HOUSE[nextIndex] ?? slots;
    const restDelta = nextRest - Math.round(restSeconds);
    const slotsDelta = nextSlots - slots;
    const restTone = deltaTone(restDelta, 'lower');
    const slotsTone = deltaTone(slotsDelta, 'higher');

    nextItems = [
      {
        id: 'next-cycle',
        label: labels.cycle,
        value: (
          <span className="flex flex-col items-end leading-tight">
            <span>{labels.cycleDuration(nextRest)}</span>
            {restTone ? <span className={restTone}>{labels.cycleDelta(restDelta)}</span> : null}
          </span>
        ),
      },
      {
        id: 'next-slots',
        label: labels.slots,
        value: (
          <span className="flex flex-col items-end leading-tight">
            <span>{nextSlots}</span>
            {slotsTone ? <span className={slotsTone}>{labels.slotsDelta(slotsDelta)}</span> : null}
          </span>
        ),
      },
    ];
  }

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{labels.title}</h2>
      </div>
      <img
        src={houseIconSrc(houseIndex)}
        alt=""
        aria-hidden
        draggable={false}
        className="mx-auto mb-2 h-20 w-auto object-contain"
      />
      <p className={tipClass}>{hasNext ? labels.tip : labels.tipMaxed}</p>
      <StatList variant="phases" className={accountStatListClass} items={currentItems} />

      {hasNext ? (
        <div className="mt-3 border-t border-line pt-3">
          <h3 className={heroAbilTitleClass}>
            {labels.nextHouseHeading(labels.houseName(nextIndex))}
          </h3>
          <StatList variant="phases" className={accountStatListClass} items={nextItems} />
        </div>
      ) : null}
    </Panel>
  );
}
