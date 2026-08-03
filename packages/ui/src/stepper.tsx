import type { ReactNode } from 'react';
import { Button as BaseButton } from '@base-ui/react/button';
import { stepperBtnClass, stepperClass, stepperValueClass } from './stepper.recipe';
import { cn } from './cn';

export type StepperProps = {
  value: ReactNode;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel?: string;
  incrementLabel?: string;
  className?: string;
};

/**
 * Stepper primitive — −/value/+ trio. Buttons delegate to `@base-ui/react`
 * (DS-06); classes come from the stepper recipe. `className` merges via `cn()`.
 */
export function Stepper({
  value,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  className,
}: StepperProps) {
  return (
    <div className={cn(stepperClass, className)}>
      <BaseButton
        type="button"
        className={stepperBtnClass}
        onClick={onDecrement}
        aria-label={decrementLabel}
      >
        −
      </BaseButton>
      <b className={stepperValueClass}>{value}</b>
      <BaseButton
        type="button"
        className={stepperBtnClass}
        onClick={onIncrement}
        aria-label={incrementLabel}
      >
        +
      </BaseButton>
    </div>
  );
}
