import {
  Children,
  isValidElement,
  useMemo,
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { Select as BaseSelect } from '@base-ui/react/select';
import { cn } from './cn';
import { Icon } from './icon';
import {
  selectAffixClass,
  selectFieldRecipe,
  selectItemClass,
  selectItemCompactClass,
  selectPopupClass,
  selectPositionerClass,
  selectValueClass,
  selectCheckItemClass,
  selectCheckboxClass,
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

export type SelectProps = Omit<ComponentPropsWithoutRef<'select'>, 'size' | 'onChange' | 'multiple'> & {
  /** Visual density — not the HTML `size` attribute (rows). */
  size?: SelectSize;
  onChange?: (event: ChangeEvent<HTMLSelectElement>) => void;
};

export type SelectMultipleProps = Omit<
  ComponentPropsWithoutRef<'select'>,
  'size' | 'onChange' | 'value' | 'defaultValue' | 'multiple'
> & {
  size?: SelectSize;
  value?: readonly string[];
  onValueChange?: (next: string[]) => void;
  /**
   * Renders the trigger from the current selection — a multi-select has no single label, and
   * "Coal, Glacier, Iron" outgrows the trigger by the third pick. Callers summarise instead.
   */
  renderValue?: (selected: readonly string[]) => ReactNode;
};

/**
 * Multi-select variant. Base UI's own `multiple` does the work — the value becomes an array, the
 * popup stays open across picks, and each chosen item reports `data-selected` for the checkmark.
 * Split into its own component rather than a `multiple?: boolean` branch on {@link Select}
 * because the two disagree on the type of `value` and on what a change even is, and a union that
 * loose pushes the narrowing onto every call site.
 */
export function SelectMultiple({
  size = 'default',
  className,
  children,
  value,
  onValueChange,
  renderValue,
  disabled,
  name,
  id,
  'aria-label': ariaLabel,
  title,
}: SelectMultipleProps) {
  const items = useMemo(() => optionsFromChildren(children), [children]);
  const itemClass = size === 'compact' ? selectItemCompactClass : selectItemClass;
  const selected = useMemo(() => [...(value ?? [])], [value]);

  return (
    <BaseSelect.Root
      multiple
      items={items}
      value={selected}
      onValueChange={(next: string[]) => onValueChange?.(next)}
      disabled={disabled}
      name={name}
      id={id}
      modal={false}
    >
      <BaseSelect.Trigger
        data-select
        data-select-multiple
        title={title}
        aria-label={ariaLabel}
        className={cn(selectFieldRecipe({ size }), className)}
      >
        <span className={selectAffixClass} aria-hidden>
          <Icon name="chevron-down" className="size-3.5" />
        </span>
        <span className={selectValueClass}>{renderValue?.(selected)}</span>
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
                  className={cn(itemClass, selectCheckItemClass)}
                >
                  <span className={selectCheckboxClass} aria-hidden>
                    <BaseSelect.ItemIndicator>
                      <Icon name="check" className="size-3" />
                    </BaseSelect.ItemIndicator>
                  </span>
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
          <Icon name="chevron-down" className="size-3.5" />
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
