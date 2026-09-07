'use client';

import { AccountHouseView } from '@bombfarm/account/panels';
import { houseLabel } from '@bombfarm/domain/game-labels';
import { resolveHouseRestSeconds, splitHouseRest } from '@bombfarm/domain/model';
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

function slotsDeltaText(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
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

  return (
    <AccountHouseView
      houseIndex={houseIdx}
      houseLevel={houseLevel}
      slots={slots}
      restSeconds={currentRest}
      labels={{
        title: t.panelHouse,
        tip: t.accountHouseTip,
        tipMaxed: t.accountHouseTipMaxed,
        house: t.house,
        level: t.houseLevelLabel,
        cycle: t.accountHouseCycle,
        cycleTip: t.accountHouseCycleTip,
        slots: t.accountCasaSlots,
        slotsTip: t.accountCasaSlotsTip,
        houseName: (houseIndex) => houseLabel(houseIndex, lang),
        nextHouseHeading: (houseName) => sub(t.accountNextHouse, { house: houseName }),
        levelOfMax: (level, maxLevel) => `${level} / ${maxLevel}`,
        cycleDuration: restText,
        cycleDelta: restDeltaText,
        slotsDelta: slotsDeltaText,
      }}
    />
  );
}
