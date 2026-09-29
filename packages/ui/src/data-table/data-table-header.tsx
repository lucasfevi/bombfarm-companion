'use client';

import { cn } from '../cn';
import { Icon } from '../icon';
import {
  dataTableHeadButtonClass,
  dataTableHeadClass,
  dataTableHeadInnerClass,
  dataTableHeadStaticClass,
} from '../data-table.recipe';
import { useDataTableScrollable } from './data-table-scrollable-context';
import { headAlignClass } from './head-align';
import { SortIdleIcon } from './sort-idle-icon';
import type { DataTableHeaderProps } from './types';

export function DataTableHeader<T extends string>(props: DataTableHeaderProps<T>) {
  const headClass = useDataTableScrollable() ? dataTableHeadClass : dataTableHeadStaticClass;

  if (props.sortable === true) {
    const {
      col,
      sortKey,
      sortDir,
      onSort,
      stopPropagation = false,
      align = 'left',
      className,
      children,
      aside,
      sortable: _sortable,
      ...thProps
    } = props;
    const active = sortKey === col;
    const button = (
      <button
        type="button"
        className={cn(
          dataTableHeadButtonClass,
          active ? 'text-accent' : 'text-inherit hover:text-ink',
          headAlignClass(align),
        )}
        onClick={(event) => {
          if (stopPropagation) event.stopPropagation();
          onSort(col);
        }}
      >
        <span>{children}</span>
        {active ? (
          sortDir === 'asc' ? (
            <Icon name="chevron-up" size="xs" />
          ) : (
            <Icon name="chevron-down" size="xs" />
          )
        ) : (
          <SortIdleIcon />
        )}
      </button>
    );

    return (
      <th
        className={cn(headClass, className)}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        {...thProps}
      >
        {aside === undefined ? (
          button
        ) : (
          <div className="flex items-center">
            {button}
            <span className="flex shrink-0 items-center pr-2">{aside}</span>
          </div>
        )}
      </th>
    );
  }

  const { align = 'left', className, children, sortable: _sortable, ...thProps } = props;

  return (
    <th className={cn(headClass, className)} {...thProps}>
      <div className={cn(dataTableHeadInnerClass, headAlignClass(align))}>{children}</div>
    </th>
  );
}
