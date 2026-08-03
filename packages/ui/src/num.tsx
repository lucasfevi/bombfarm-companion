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

  // `decimals` is display-only — never round a committed value. Rounding here would
  // quietly downgrade precision that didn't come from the display (e.g. an imported
  // save's full-float skill-tree bonus) every time the field is nudged, even by a single
  // step click, permanently losing digits the display never had a chance to show anyway.
  function commit(next: number) {
    if (Number.isFinite(next)) onChange(next);
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
        onWheel={(event) => {
          // Focused number inputs step natively on scroll — easy to trigger by accident
          // while scrolling the page. Blur so the wheel event scrolls the page instead of
          // silently nudging the field from its rounded `shown` display baseline.
          event.currentTarget.blur();
        }}
        onKeyDown={(event) => {
          // Native Up/Down stepping computes from the input's displayed (rounded) text,
          // not the full-precision `value` prop — route it through the same precise
          // commit the chevron buttons use instead of letting the browser step it.
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            commit(value + step);
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            commit(value - step);
          }
        }}
      />
    </div>
  );
}
