'use client';

import { FORJA_MAX } from '@bombfarm/domain/gear';
import { Stepper } from '@bombfarm/ui';
import type { TeamPlanCopy } from '../copy';

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
export function ForgeFloorField({
  t,
  value,
  onChange,
}: {
  t: TeamPlanCopy;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="min-w-30 max-w-sm flex-1">
      <label className={fieldLabelClass}>
        <span>{t.teamPlanForgeFloorLabel}</span>
        <Stepper
          className={setupFieldStepperClass}
          valueClassName="text-[13px]"
          value={value}
          decrementLabel={`${t.teamPlanForgeFloorLabel} −`}
          incrementLabel={`${t.teamPlanForgeFloorLabel} +`}
          onDecrement={() => onChange(Math.max(0, value - 1))}
          onIncrement={() => onChange(Math.min(FORJA_MAX, value + 1))}
        />
      </label>
      <p className="m-0 mt-2 text-[12px] text-muted">{t.teamPlanForgeFloorHint}</p>
    </div>
  );
}
