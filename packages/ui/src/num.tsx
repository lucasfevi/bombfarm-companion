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
  /** Lower bound for every committed value, typed or stepped. Outranks `max` if the two cross. */
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
  const [lastValue, setLastValue] = useState(value);

  function round(n: number): number {
    return decimals != null && Number.isFinite(n) ? Number(n.toFixed(decimals)) : n;
  }

  /**
   * A bound rounded to `decimals`, then stepped one tick back if rounding crossed it — `decimals`
   * is a promise about every committed value, so a finer bound has to move, and it has to move
   * into range rather than out of it. Rounding is compared against the bound itself rather than
   * scaling it by a power of ten: `0.29 * 100` is `28.999999999999996`, so scaling reports an
   * ordinary two-decimal bound as finer than it is and walks it a tick the wrong way.
   */
  function quantizeBound(n: number, direction: 'down' | 'up'): number {
    if (decimals == null || !Number.isFinite(n)) return n;
    const rounded = Number(n.toFixed(decimals));
    const crossed = direction === 'down' ? rounded > n : rounded < n;
    if (!crossed) return rounded;
    const tick = 10 ** -decimals;
    return Number((direction === 'down' ? rounded - tick : rounded + tick).toFixed(decimals));
  }

  const floor = min != null ? quantizeBound(min, 'up') : undefined;
  /**
   * `min` outranks `max` when the two cross. Clamping applies the ceiling last, so a `max` below
   * `min` would otherwise void the floor and commit under it.
   */
  const ceiling =
    max != null ? Math.max(quantizeBound(max, 'down'), floor ?? -Infinity) : undefined;

  function clamp(n: number): number {
    const floored = floor != null ? Math.max(floor, n) : n;
    return ceiling != null ? Math.min(ceiling, floored) : floored;
  }

  /** The value a raw field entry asks for, or `null` when no finite number can be read from it. */
  function entryOf(raw: string): number | null {
    if (raw.trim() === '') return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clamp(round(parsed)) : null;
  }

  /**
   * A `value` this field did not ask for — a form reset, an import, a switch of subject — replaces
   * the draft, which described the one before it. A `value` that is what the draft asked for is
   * this field's own commit coming back, and leaves the half-typed text alone.
   *
   * Accepted, not a bug: an outside writer that lands on exactly the number the draft would commit
   * is indistinguishable from this field's own echo, so the half-typed text survives it. Blur
   * resolves it, and the text clamps to that same number anyway. Widening this to clear on any
   * change is worse — it makes the field jump mid-entry, because a bounded entry commits its clamp
   * on the keystroke that crosses the bound and the echo would then overwrite what is being typed.
   */
  if (!Object.is(lastValue, value)) {
    setLastValue(value);
    const asked = draft == null ? null : entryOf(draft);
    if (asked == null || !Object.is(asked, value)) setDraft(null);
  }

  /**
   * An out-of-bounds `value` is shown, and stepped from, as its in-bounds equivalent. A field that
   * displays what its own bounds forbid also steps from it, which sends the arrows the wrong way:
   * incrementing 9999 under `max=500` commits 500, so the up arrow walks the value down.
   */
  const shown = Number.isFinite(value) ? clamp(round(value)) : value;

  function stepBy(delta: number) {
    setDraft(null);
    if (!Number.isFinite(shown)) return;
    onChange(clamp(round(shown + delta)));
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
        min={floor}
        max={ceiling}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          const next = entryOf(raw);
          if (next != null) onChange(next);
        }}
        onBlur={() => setDraft(null)}
      />
    </div>
  );
}
