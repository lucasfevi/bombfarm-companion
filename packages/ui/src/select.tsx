import {
  Children,
  isValidElement,
  useMemo,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { HiMiniChevronDown } from 'react-icons/hi2';
import { cn } from './cn';
import {
  selectAffixClass,
  selectFieldRecipe,
  selectItemClass,
  selectItemCompactClass,
  selectPopupClass,
  selectPositionerClass,
  selectValueClass,
  type SelectSize,
} from './select.recipe';

type OptionItem = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

function optionsFromChildren(children: ReactNode): OptionItem[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) {
      return [];
    }
    if (child.type !== 'option') return [];
    return [
      {
        value: String(child.props.value ?? ''),
        label: child.props.children,
        disabled: Boolean(child.props.disabled),
      },
    ];
  });
}

export type SelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'size' | 'onChange'> & {
  /** Visual density — not the HTML `size` attribute (rows). */
  size?: SelectSize;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
};

/**
 * Select primitive — Base UI select dressed like `Num` (left chevron affix).
 * Popup/options are fully themed (native `<option>` menus cannot be).
 *
 * Keep `<option>` children for call-site familiarity; they are converted to
 * popup items. `onChange` still receives a synthetic `ChangeEvent` with
 * `target.value` as a string.
 */
export function Select({
  size = 'default',
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  name,
  id,
  required,
  'aria-label': ariaLabel,
  title,
}: SelectProps) {
  const items = useMemo(() => optionsFromChildren(children), [children]);
  const itemClass = size === 'compact' ? selectItemCompactClass : selectItemClass;

  const controlled = value !== undefined;
  const stringValue = controlled ? String(value) : undefined;
  const stringDefault =
    defaultValue !== undefined && defaultValue !== null ? String(defaultValue) : undefined;

  function emitChange(next: string | null) {
    if (!onChange) return;
    const nextValue = next ?? '';
    onChange({
      target: { value: nextValue },
      currentTarget: { value: nextValue },
    } as ChangeEvent<HTMLSelectElement>);
  }

  return (
    <BaseSelect.Root
      items={items}
      value={controlled ? stringValue : undefined}
      defaultValue={controlled ? undefined : stringDefault}
      onValueChange={emitChange}
      disabled={disabled}
      name={name}
      id={id}
      required={required}
      modal={false}
    >
      <BaseSelect.Trigger
        data-select
        title={title}
        aria-label={ariaLabel}
        className={cn(selectFieldRecipe({ size }), className)}
      >
        <span className={selectAffixClass} aria-hidden>
          <HiMiniChevronDown className="size-3.5" />
        </span>
        <BaseSelect.Value className={selectValueClass} />
      </BaseSelect.Trigger>

      <BaseSelect.Portal>
        <BaseSelect.Positioner
          className={selectPositionerClass}
          alignItemWithTrigger={false}
          sideOffset={4}
          align="start"
        >
          <BaseSelect.Popup className={selectPopupClass}>
            <BaseSelect.List>
              {items.map((item) => (
                <BaseSelect.Item
                  key={item.value === '' ? '__empty' : item.value}
                  value={item.value}
                  disabled={item.disabled}
                  className={itemClass}
                >
                  <BaseSelect.ItemText>{item.label}</BaseSelect.ItemText>
                </BaseSelect.Item>
              ))}
            </BaseSelect.List>
          </BaseSelect.Popup>
        </BaseSelect.Positioner>
      </BaseSelect.Portal>
    </BaseSelect.Root>
  );
}
