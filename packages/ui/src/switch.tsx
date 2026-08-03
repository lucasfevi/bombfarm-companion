import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { cn } from './cn';
import { switchRootRecipe, switchThumbClass, type SwitchSize } from './switch.recipe';

export type SwitchProps = {
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
  size?: SwitchSize;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  title?: string;
};

/**
 * Switch primitive — wraps `@base-ui/react/switch` (Root + Thumb) and dresses
 * it with planner tokens. Prefer this over inventing Button/checkbox toggles
 * for boolean account flags.
 */
export function Switch({
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
  size = 'default',
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  title,
}: SwitchProps) {
  return (
    <BaseSwitch.Root
      data-switch
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
      title={title}
      className={cn(switchRootRecipe({ size }), className)}
    >
      <BaseSwitch.Thumb className={switchThumbClass} />
    </BaseSwitch.Root>
  );
}
