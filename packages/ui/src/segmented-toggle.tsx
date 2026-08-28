import { segmentedToggleItemRecipe, segmentedToggleRootClass } from './segmented-toggle.recipe';
import { cn } from './cn';

export interface SegmentedToggleOption {
  id: string;
  label: string;
}

export interface SegmentedToggleProps {
  options: ReadonlyArray<SegmentedToggleOption>;
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * SegmentedToggle — the bordered flush button group behind the web's PT/EN language control,
 * promoted as a generic two-or-more-option control. No language semantics live here:
 * callers supply their own `options`/`value`/`onChange`.
 */
export function SegmentedToggle({ options, value, onChange, ariaLabel, className }: SegmentedToggleProps) {
  return (
    <div className={cn(segmentedToggleRootClass, className)} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={segmentedToggleItemRecipe({ active: option.id === value })}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
