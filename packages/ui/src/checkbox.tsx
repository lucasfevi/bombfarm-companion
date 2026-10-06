import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { cn } from './cn';
import { checkboxIndicatorClass, checkboxRootClass } from './checkbox.recipe';
import { Icon } from './icon';

export type CheckboxProps = {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  value?: string;
  className?: string;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
};

/**
 * Checkbox primitive — wraps `@base-ui/react/checkbox` (Root + Indicator) and dresses it with
 * planner tokens. For a tick list where each row is picked on its own; a lone on/off account flag
 * is a `Switch`.
 */
export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  readOnly,
  required,
  name,
  id,
  value,
  className,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
}: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      data-checkbox
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
      name={name}
      id={id}
      value={value}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      className={cn(checkboxRootClass, className)}
    >
      <BaseCheckbox.Indicator className={checkboxIndicatorClass}>
        <Icon name="check" className="size-3" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}
