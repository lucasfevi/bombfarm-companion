'use client';

import { FORJA_MAX } from '@bombfarm/domain/gear';
import { Stepper } from '@bombfarm/ui';
import type { TeamPlanCopy } from '../copy';
import { SetupField } from './setup-field';

/**
 * Sized to the row it sits in, not to the shared primitive: the bar's other controls are 34px
 * bordered fields, so the stepper's default 24px reads as a shrunken control between them, while
 * its other two consumers sit in a dense table row and an inline toolbar where 24px is deliberate.
 */
const setupFieldStepperClass = '[&>button]:size-[34px]';

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
    <SetupField
      label={t.teamPlanForgeFloorLabel}
      hint={t.teamPlanForgeFloorHint}
      className="min-w-30 max-w-sm flex-1"
      testId="team-plan-forge-floor-field"
    >
      <Stepper
        className={setupFieldStepperClass}
        valueClassName="text-[13px]"
        value={value}
        decrementLabel={`${t.teamPlanForgeFloorLabel} −`}
        incrementLabel={`${t.teamPlanForgeFloorLabel} +`}
        onDecrement={() => onChange(Math.max(0, value - 1))}
        onIncrement={() => onChange(Math.min(FORJA_MAX, value + 1))}
      />
    </SetupField>
  );
}
