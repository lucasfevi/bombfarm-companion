import type { ReactNode } from 'react';
import { Button as BaseButton } from '@base-ui/react/button';
import { stepperBtnClass, stepperClass, stepperGlyphClass, stepperValueClass } from './stepper.recipe';
import { cn } from './cn';

export type StepperProps = {
  value: ReactNode;
  onDecrement: () => void;
  onIncrement: () => void;
  decrementLabel?: string;
  incrementLabel?: string;
  className?: string;
  /** Merged onto the value slot — a caller whose number is the headline of its row sets the
   *  type size here, so the `3ch` slot is measured in that size and still fits. */
  valueClassName?: string;
};

/**
 * Stepper primitive — −/value/+ trio. Buttons delegate to `@base-ui/react`;
 * classes come from the stepper recipe. `className` merges via `cn()`.
 */
export function Stepper({
  value,
  onDecrement,
  onIncrement,
  decrementLabel,
  incrementLabel,
  className,
  valueClassName,
}: StepperProps) {
  return (
    <div className={cn(stepperClass, className)}>
      <BaseButton
        type="button"
        className={stepperBtnClass}
        onClick={onDecrement}
        aria-label={decrementLabel}
      >
        <span className={stepperGlyphClass}>−</span>
      </BaseButton>
      <b className={cn(stepperValueClass, valueClassName)}>{value}</b>
      <BaseButton
        type="button"
        className={stepperBtnClass}
        onClick={onIncrement}
        aria-label={incrementLabel}
      >
        <span className={stepperGlyphClass}>+</span>
      </BaseButton>
    </div>
  );
}
