import { Button as BaseButton } from '@base-ui/react/button';
import { cn } from './cn';
import { Icon } from './icon';
import { numFieldClass, numInputClass, numSpinBtnClass, numSpinClass } from './stepper.recipe';

export function Num({
  value,
  onChange,
  step = 0.1,
  decimals,
  incrementLabel,
  decrementLabel,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  /** When set, display and round the value to this many fraction digits. */
  decimals?: number;
  /** Accessible name for the step-up button — the host passes it from its own dictionary. */
  incrementLabel: string;
  /** Accessible name for the step-down button — the host passes it from its own dictionary. */
  decrementLabel: string;
  className?: string;
}) {
  const shown =
    decimals != null && Number.isFinite(value) ? Number(value.toFixed(decimals)) : value;

  function commit(next: number) {
    onChange(decimals != null && Number.isFinite(next) ? Number(next.toFixed(decimals)) : next);
  }

  return (
    <div data-num className={cn(numFieldClass, className)}>
      <div className={numSpinClass}>
        <BaseButton
          type="button"
          tabIndex={-1}
          className={numSpinBtnClass}
          aria-label={incrementLabel}
          onClick={() => commit(value + step)}
        >
          <Icon name="chevron-up" className="size-3.5" />
        </BaseButton>
        <BaseButton
          type="button"
          tabIndex={-1}
          className={cn(numSpinBtnClass, 'border-t border-line')}
          aria-label={decrementLabel}
          onClick={() => commit(value - step)}
        >
          <Icon name="chevron-down" className="size-3.5" />
        </BaseButton>
      </div>
      <input
        data-num-input
        className={numInputClass}
        type="number"
        value={shown}
        step={step}
        onChange={(event) => {
          const raw = Number(event.target.value);
          commit(raw);
        }}
      />
    </div>
  );
}
