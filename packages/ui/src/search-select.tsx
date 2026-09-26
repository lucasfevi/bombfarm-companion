import { useMemo, useState, type ReactNode } from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { cn } from './cn';
import { Icon } from './icon';
import { SelectPopupHeader, type SelectMultipleHeader } from './select';
import {
  selectAffixClass,
  selectCheckboxClass,
  selectCheckItemClass,
  selectFieldRecipe,
  selectItemClass,
  selectItemCompactClass,
  selectListClass,
  selectPopupClass,
  selectPopupMultipleClass,
  selectPositionerClass,
  selectValueClass,
  type SelectSize,
} from './select.recipe';
import {
  searchSelectEmptyClass,
  searchSelectInputClass,
  searchSelectNoteClass,
  searchSelectPopupClass,
  searchSelectSearchRowClass,
} from './search-select.recipe';

export type SearchSelectOption = {
  value: string;
  /** Shown in the row, in the trigger, and matched against the query. There is deliberately no
   *  second "search text" field: a row that answers to a word it does not show is a row the
   *  player cannot learn to search for. */
  label: string;
};

export type SearchSelectProps = {
  options: readonly SearchSelectOption[];
  /** The selected option's `value`. A value no option carries reads as nothing selected. */
  value: string;
  onValueChange: (value: string) => void;
  /** Visual density — matches `Select`'s. */
  size?: SelectSize;
  disabled?: boolean;
  id?: string;
  name?: string;
  'aria-label'?: string;
  className?: string;
  /** Placeholder for the search field inside the popup, not for the trigger. */
  searchPlaceholder?: string;
  emptyLabel: ReactNode;
  /**
   * The note under a truncated list. Called with how many rows are drawn and how many matched, so
   * the caller can say "50 of 601 — keep typing" in its own language.
   */
  overflowLabel?: (shown: number, matched: number) => ReactNode;
  /** How many matching rows to draw. See {@link SEARCH_SELECT_DEFAULT_LIMIT}. */
  limit?: number;
};

/**
 * Rows drawn per query, matched-but-undrawn rows reported by `overflowLabel`.
 *
 * A cap rather than virtualisation: this control's lists are long (600 phases) but its answers are
 * few — a query narrow enough to be worth reading is well under this, and a query that is not is
 * better answered by "keep typing" than by 600 mounted rows the player must scroll. Virtualising
 * would buy nothing a player can see, at the price of a measured scroller inside a popup.
 */
export const SEARCH_SELECT_DEFAULT_LIMIT = 50;

/** Case- and accent-insensitive: `Difícil` has to answer to `dificil` on a keyboard without them. */
function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Every whitespace-separated token of the query must appear in the label, in any order — so
 * `1-1 hard` finds `Hard 1-1` and a stray trailing space narrows nothing.
 */
export function searchSelectMatches(option: SearchSelectOption, query: string): boolean {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = normalize(option.label);
  return tokens.every((token) => haystack.includes(token));
}

/**
 * Single-select over a list too long to scroll — a `Select` trigger over a popup with its own
 * search field, wrapping Base UI's `Combobox`.
 *
 * The query lives in the popup rather than in the trigger (the `Autocomplete` shape) because the
 * trigger has to keep showing the current selection while the player types a different one, and
 * because a query typed into a field already holding the selected label starts out filtering the
 * list down to that one row.
 *
 * Filtering is ours, not Base UI's `filter` prop: the count of matches is what `overflowLabel`
 * needs, and only the side doing the matching knows it.
 */
export function SearchSelect({
  options,
  value,
  onValueChange,
  size = 'default',
  disabled,
  id,
  name,
  'aria-label': ariaLabel,
  className,
  searchPlaceholder,
  emptyLabel,
  overflowLabel,
  limit = SEARCH_SELECT_DEFAULT_LIMIT,
}: SearchSelectProps) {
  const [query, setQuery] = useState('');
  const itemClass = size === 'compact' ? selectItemCompactClass : selectItemClass;

  const matched = useMemo(
    () => options.filter((option) => searchSelectMatches(option, query)),
    [options, query],
  );
  const visible = useMemo(() => matched.slice(0, Math.max(0, limit)), [matched, limit]);
  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  return (
    <Combobox.Root<SearchSelectOption>
      items={options as SearchSelectOption[]}
      filteredItems={visible}
      filter={null}
      value={selected}
      onValueChange={(next) => onValueChange(next?.value ?? '')}
      isItemEqualToValue={(item, candidate) => item?.value === candidate?.value}
      itemToStringLabel={(item) => item?.label ?? ''}
      itemToStringValue={(item) => item?.value ?? ''}
      inputValue={query}
      onInputValueChange={setQuery}
      // The query is transient, not part of the selection: leaving it behind would reopen the
      // popup already filtered by whatever the player typed last time.
      onOpenChange={(open) => {
        if (!open) setQuery('');
      }}
      disabled={disabled}
      name={name}
      id={id}
      modal={false}
    >
      <Combobox.Trigger
        data-select
        data-search-select
        aria-label={ariaLabel}
        className={cn(selectFieldRecipe({ size }), className)}
      >
        <span className={selectAffixClass} aria-hidden>
          <Icon name="chevron-down" className="size-3.5" />
        </span>
        <span className={selectValueClass}>
          <Combobox.Value>{(option: SearchSelectOption | null) => option?.label ?? ''}</Combobox.Value>
        </span>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner className={selectPositionerClass} sideOffset={4} align="start">
          <Combobox.Popup className={cn(selectPopupClass, searchSelectPopupClass)}>
            <div className={searchSelectSearchRowClass}>
              {/* Named by its placeholder alone: repeating the trigger's label here would put two
                  same-named comboboxes on the page whenever the popup is open. */}
              <Combobox.Input placeholder={searchPlaceholder} className={searchSelectInputClass} />
            </div>
            <Combobox.Empty className={searchSelectEmptyClass}>{emptyLabel}</Combobox.Empty>
            <Combobox.List className={selectListClass}>
              {visible.map((option) => (
                <Combobox.Item key={option.value} value={option} className={itemClass}>
                  {option.label}
                </Combobox.Item>
              ))}
            </Combobox.List>
            {overflowLabel && matched.length > visible.length ? (
              <p className={cn(searchSelectNoteClass, 'm-0 border-t border-line')}>
                {overflowLabel(visible.length, matched.length)}
              </p>
            ) : null}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

export type SearchSelectMultipleProps = {
  options: readonly SearchSelectOption[];
  /** The ticked options' values. */
  value: readonly string[];
  onValueChange: (next: string[]) => void;
  /** The trigger's text — a multi-select has no single label, so the caller summarises. */
  renderValue: (selected: readonly string[]) => ReactNode;
  size?: SelectSize;
  disabled?: boolean;
  'aria-label'?: string;
  className?: string;
  header?: SelectMultipleHeader;
  searchPlaceholder?: string;
  emptyLabel: ReactNode;
};

/**
 * `SelectMultiple` with the search field of {@link SearchSelect}: the same trigger, header and
 * checkbox rows, over a popup that narrows as the player types. Base UI's `Combobox` in its
 * `multiple` mode does the work, since its select has no field to type into; the query clears
 * when the popup closes, as {@link SearchSelect}'s does.
 */
export function SearchSelectMultiple({
  options,
  value,
  onValueChange,
  renderValue,
  size = 'default',
  disabled,
  'aria-label': ariaLabel,
  className,
  header,
  searchPlaceholder,
  emptyLabel,
}: SearchSelectMultipleProps) {
  const [query, setQuery] = useState('');
  const itemClass = size === 'compact' ? selectItemCompactClass : selectItemClass;

  const visible = useMemo(() => options.filter((option) => searchSelectMatches(option, query)), [options, query]);
  const selected = useMemo(() => options.filter((option) => value.includes(option.value)), [options, value]);

  return (
    <Combobox.Root<SearchSelectOption, true>
      multiple
      items={options as SearchSelectOption[]}
      filteredItems={visible}
      filter={null}
      value={selected}
      onValueChange={(next) => onValueChange(next.map((option) => option.value))}
      isItemEqualToValue={(item, candidate) => item.value === candidate.value}
      itemToStringLabel={(item) => item.label}
      itemToStringValue={(item) => item.value}
      inputValue={query}
      onInputValueChange={setQuery}
      onOpenChange={(open) => {
        if (!open) setQuery('');
      }}
      disabled={disabled}
      modal={false}
    >
      <Combobox.Trigger
        data-select
        data-select-multiple
        data-search-select
        aria-label={ariaLabel}
        className={cn(selectFieldRecipe({ size }), className)}
      >
        <span className={selectAffixClass} aria-hidden>
          <Icon name="chevron-down" className="size-3.5" />
        </span>
        <span className={selectValueClass}>{renderValue(value)}</span>
      </Combobox.Trigger>

      <Combobox.Portal>
        <Combobox.Positioner className={selectPositionerClass} sideOffset={4} align="start">
          <Combobox.Popup className={cn(selectPopupClass, selectPopupMultipleClass)}>
            {header ? <SelectPopupHeader header={header} /> : null}
            <div className={searchSelectSearchRowClass}>
              <Combobox.Input placeholder={searchPlaceholder} className={searchSelectInputClass} />
            </div>
            <Combobox.Empty className={searchSelectEmptyClass}>{emptyLabel}</Combobox.Empty>
            <Combobox.List className={selectListClass}>
              {visible.map((option) => (
                <Combobox.Item key={option.value} value={option} className={cn(itemClass, selectCheckItemClass)}>
                  <span className={selectCheckboxClass} aria-hidden>
                    <Combobox.ItemIndicator>
                      <Icon name="check" className="size-3" />
                    </Combobox.ItemIndicator>
                  </span>
                  {option.label}
                </Combobox.Item>
              ))}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
