'use client';

import { FORJA_MAX } from '@bombfarm/domain/gear';
import { Panel, Stepper } from '@bombfarm/ui';
import { panelHClass, panelTitleClass } from '@bombfarm/ui/panel-field.recipe';
import type { Strings } from '@/shared/i18n';
import { usePlannerStore, selectForgeFloor } from '@/shared/stores';

const fieldLabelClass =
  'flex flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

export function ForgeFloorField({ t }: { t: Strings }) {
  const forgeFloor = usePlannerStore(selectForgeFloor);
  const setForgeFloor = usePlannerStore((state) => state.setForgeFloor);

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.gearPlanForgeFloorLabel}</h2>
      </div>
      <label className={fieldLabelClass}>
        <span>{t.gearPlanForgeFloorLabel}</span>
        <Stepper
          value={forgeFloor}
          decrementLabel={`${t.gearPlanForgeFloorLabel} −`}
          incrementLabel={`${t.gearPlanForgeFloorLabel} +`}
          onDecrement={() => setForgeFloor(Math.max(0, forgeFloor - 1))}
          onIncrement={() => setForgeFloor(Math.min(FORJA_MAX, forgeFloor + 1))}
        />
      </label>
      <p className="m-0 mt-2 text-[12px] text-muted">{t.gearPlanForgeFloorHint}</p>
    </Panel>
  );
}
