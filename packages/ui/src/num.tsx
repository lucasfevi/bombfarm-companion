import { Button as BaseButton } from '@base-ui/react/button';
import { HiMiniChevronDown, HiMiniChevronUp } from 'react-icons/hi2';
import { cn } from './cn';
import { numFieldClass, numInputClass, numSpinBtnClass, numSpinClass } from './stepper.recipe';

export function Num({
  value,
  onChange,
  step = 0.1,
  decimals,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  /** When set, display and round the value to this many fraction digits. */
  decimals?: number;
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
          aria-label="Increment"
          onClick={() => commit(value + step)}
        >
          <HiMiniChevronUp className="size-3.5" aria-hidden />
        </BaseButton>
        <BaseButton
          type="button"
          tabIndex={-1}
          className={cn(numSpinBtnClass, 'border-t border-line')}
          aria-label="Decrement"
          onClick={() => commit(value - step)}
        >
          <HiMiniChevronDown className="size-3.5" aria-hidden />
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
