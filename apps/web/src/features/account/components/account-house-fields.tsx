'use client';

import { sub } from '@/shared/i18n';
import { useAppLang } from '@/shared/context/app-lang';
import { houseLabel } from '@bombfarm/domain/game-labels';
import { HOUSES, resolveHouseRestSeconds, splitHouseRest } from '@bombfarm/domain/model';
import { Num, Select } from '@bombfarm/ui';
import { Fields } from '@bombfarm/ui';
import {
  usePlannerStore,
  selectHouseIdx,
  selectHouseLevel,
  selectHouseCycleSecs,
  selectHouseCycleSecsHouseIdx,
  selectHouseCycleSecsLevel,
} from '@/shared/stores';
import {
  accountHouseStackClass,
  heroAbilTitleClass,
} from '@bombfarm/ui/panel-field.recipe';

export function AccountHouseFields() {
  const { t, lang } = useAppLang();
  const houseIdx = usePlannerStore(selectHouseIdx);
  const houseLevel = usePlannerStore(selectHouseLevel);
  const houseCycleSecs = usePlannerStore(selectHouseCycleSecs);
  const houseCycleSecsHouseIdx = usePlannerStore(selectHouseCycleSecsHouseIdx);
  const houseCycleSecsLevel = usePlannerStore(selectHouseCycleSecsLevel);
  const setHouseIdx = usePlannerStore((state) => state.setHouseIdx);
  const setHouseLevel = usePlannerStore((state) => state.setHouseLevel);

  // Same resolver the model uses (`farmContextForHero`) — not the raw `HOUSES` table alone, so
  // this panel never contradicts the DPS/farm-board/team-plan numbers it labels.
  const rest = splitHouseRest(
    resolveHouseRestSeconds(
      houseCycleSecs,
      houseIdx,
      houseLevel,
      houseCycleSecsHouseIdx,
      houseCycleSecsLevel,
    ),
  );
  const houseName = houseLabel(houseIdx, lang);

  return (
    <div className="mb-2">
      <h3 className={heroAbilTitleClass}>{t.panelHouse}</h3>
      <Fields layout="stack" className={accountHouseStackClass}>
        <label>
          <span>{t.house}</span>
          <Select
            value={String(houseIdx)}
            title={houseName}
            onChange={(event) => setHouseIdx(Number(event.target.value))}
          >
            {HOUSES.map((_, index) => (
              <option key={index} value={index}>
                {houseLabel(index, lang)}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span>
            {t.houseLevelLabel}
            <span data-field-hint>
              {sub(t.houseRestHint, {
                minutes: String(rest.minutes),
                seconds: String(rest.seconds),
              })}
            </span>
          </span>
          <Num
            value={houseLevel}
            onChange={(value) => setHouseLevel(Math.min(20, Math.max(0, Math.round(value))))}
            step={1}
            decimals={0}
          />
        </label>
      </Fields>
    </div>
  );
}
