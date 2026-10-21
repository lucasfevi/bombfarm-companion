import { segmentedToggleItemRecipe, segmentedToggleRootClass } from './segmented-toggle.recipe';
import { cn } from './cn';
import type { SegmentedToggleOption } from './segmented-toggle';

export type SegmentedToggleFormProps = {
  options: ReadonlyArray<SegmentedToggleOption>;
  /** The selected option's id. */
  value: string;
  /** The field name each option button submits its id under. */
  name: string;
  ariaLabel: string;
  action?: string;
  method?: 'get' | 'post';
  /** Extra fields to submit alongside the chosen option. */
  hidden?: Readonly<Record<string, string>>;
  className?: string;
};

/**
 * The segmented toggle for a plain form post: it renders its own `<form>`, and each option is a
 * submit button carrying its own id, so it works without JavaScript.
 */
export function SegmentedToggleForm({
  options,
  value,
  name,
  ariaLabel,
  action,
  method = 'get',
  hidden,
  className,
}: SegmentedToggleFormProps) {
  return (
    <form method={method} {...(action === undefined ? {} : { action })} className="inline-flex">
      {hidden
        ? Object.entries(hidden).map(([key, fieldValue]) => <input key={key} type="hidden" name={key} value={fieldValue} />)
        : null}
      <div className={cn(segmentedToggleRootClass, className)} role="group" aria-label={ariaLabel}>
        {options.map((option) => (
          <button
            key={option.id}
            type="submit"
            name={name}
            value={option.id}
            aria-pressed={option.id === value}
            className={segmentedToggleItemRecipe({ active: option.id === value })}
          >
            {option.label}
          </button>
        ))}
      </div>
    </form>
  );
}
