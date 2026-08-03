import { cn } from './cn';
import { readonlyNumClass } from './stepper.recipe';

/**
 * Read-only numeric readout sized like `Num` (`[data-readonly-num]`).
 * Use for import-sourced values that must keep full store precision —
 * display rounds for readability; the store is never written from this control.
 */
export function ReadonlyNum({
  value,
  decimals,
  className,
}: {
  value: number;
  /** Display fraction digits only — does not mutate `value`. */
  decimals?: number;
  className?: string;
}) {
  const shown =
    decimals != null && Number.isFinite(value) ? value.toFixed(decimals) : String(value);

  return (
    <span data-readonly-num className={cn(readonlyNumClass, className)}>
      {shown}
    </span>
  );
}
