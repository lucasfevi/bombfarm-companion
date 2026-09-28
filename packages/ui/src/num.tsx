import { Button as BaseButton } from '@base-ui/react/button';
import { useState } from 'react';
import { cn } from './cn';
import { Icon } from './icon';
import { numFieldClass, numInputClass, numSpinBtnClass, numSpinClass } from './stepper.recipe';

export function Num({
  value,
  onChange,
  step = 0.1,
  decimals,
  min,
  max,
  incrementLabel,
  decrementLabel,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  /** When set, display and round the value to this many fraction digits. */
  decimals?: number;
  /** Lower bound for every committed value, typed or stepped. */
  min?: number;
  /** Upper bound for every committed value, typed or stepped. */
  max?: number;
  /** Accessible name for the step-up button — the host passes it from its own dictionary. */
  incrementLabel: string;
  /** Accessible name for the step-down button — the host passes it from its own dictionary. */
  decrementLabel: string;
  className?: string;
}) {
  /**
   * What the field shows while it holds something no number can be read from — `null` means it
   * shows the prop. A number field reports an emptied or half-typed entry as `''`, and
   * `Number('')` is `0`, so without somewhere to park the raw text a select-all-delete commits a
   * real `0` to the consumer and rescales everything downstream of it.
   */
  const [draft, setDraft] = useState<string | null>(null);

  const shown =
    decimals != null && Number.isFinite(value) ? Number(value.toFixed(decimals)) : value;

  function commit(next: number) {
    if (!Number.isFinite(next)) return;
    const rounded = decimals != null ? Number(next.toFixed(decimals)) : next;
    const floored = min != null ? Math.max(min, rounded) : rounded;
    onChange(max != null ? Math.min(max, floored) : floored);
  }

  function stepBy(delta: number) {
    setDraft(null);
    commit(value + delta);
  }

  return (
    <div data-num className={cn(numFieldClass, className)}>
      <div className={numSpinClass}>
        <BaseButton
          type="button"
          tabIndex={-1}
          className={numSpinBtnClass}
          aria-label={incrementLabel}
          onClick={() => stepBy(step)}
        >
          <Icon name="chevron-up" className="size-3.5" />
        </BaseButton>
        <BaseButton
          type="button"
          tabIndex={-1}
          className={cn(numSpinBtnClass, 'border-t border-line')}
          aria-label={decrementLabel}
          onClick={() => stepBy(-step)}
        >
          <Icon name="chevron-down" className="size-3.5" />
        </BaseButton>
      </div>
      <input
        data-num-input
        className={numInputClass}
        type="number"
        value={draft ?? shown}
        step={step}
        min={min}
        max={max}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw.trim() === '') return;
          commit(Number(raw));
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}
