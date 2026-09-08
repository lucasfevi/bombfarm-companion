'use client';

import { FORJA_MAX } from '@bombfarm/domain/gear';
import { Stepper } from '@bombfarm/ui';
import type { Strings } from '@/shared/i18n';
import { usePlannerStore, selectForgeFloor } from '@/shared/stores';

const fieldLabelClass =
  'flex min-w-0 flex-col gap-[3px] text-[11px] tracking-[0.03em] text-muted uppercase';

/**
 * Sizes this stepper to the row it sits in, and NOT the shared primitive.
 *
 * Two things are local to this one use. The height: the setup bar's other controls are 34px
 * bordered fields (`Select`, `SearchSelect`), so the primitive's default 24px reads as a shrunken
 * control between them — while the primitive's other two consumers sit in a dense table row and
 * an inline toolbar, where 24px is deliberate and paired with `h-6` neighbours. The type: a
 * stepper inside `fieldLabelClass` inherits that label's 11px uppercase letter-spacing, so its
 * `−`/`+` render two sizes below the row and carry a trailing letter-space; neither other
 * consumer sits inside an uppercase label. Both are this field's context, so both are fixed here.
 */
const setupFieldStepperClass = 'text-[13px] tracking-normal [&>button]:size-[34px]';

/** Forge-floor stepper + hint — no panel chrome (lives inside the search setup bar). */
export function ForgeFloorField({ t }: { t: Strings }) {
  const forgeFloor = usePlannerStore(selectForgeFloor);
  const setForgeFloor = usePlannerStore((state) => state.setForgeFloor);

  return (
    <div className="min-w-0 max-w-sm flex-1">
      <label className={fieldLabelClass}>
        <span>{t.teamPlanForgeFloorLabel}</span>
        <Stepper
          className={setupFieldStepperClass}
          valueClassName="text-[13px]"
          value={forgeFloor}
          decrementLabel={`${t.teamPlanForgeFloorLabel} −`}
          incrementLabel={`${t.teamPlanForgeFloorLabel} +`}
          onDecrement={() => setForgeFloor(Math.max(0, forgeFloor - 1))}
          onIncrement={() => setForgeFloor(Math.min(FORJA_MAX, forgeFloor + 1))}
        />
      </label>
      <p className="m-0 mt-2 text-[12px] text-muted">{t.teamPlanForgeFloorHint}</p>
    </div>
  );
}
