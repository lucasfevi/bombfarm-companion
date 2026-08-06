'use client';

import { cn } from '../cn';
import { Icon } from '../icon';
import { dataTableHeadButtonClass, dataTableHeadClass, dataTableHeadInnerClass } from '../data-table.recipe';
import { headAlignClass } from './head-align';
import { SortIdleIcon } from './sort-idle-icon';
import type { DataTableHeaderProps } from './types';

export function DataTableHeader<T extends string>(props: DataTableHeaderProps<T>) {
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
      sortable: _sortable,
      ...thProps
    } = props;
    const active = sortKey === col;

    return (
      <th
        className={cn(dataTableHeadClass, className)}
        aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
        {...thProps}
      >
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
      </th>
    );
  }

  const { align = 'left', className, children, sortable: _sortable, ...thProps } = props;

  return (
    <th className={cn(dataTableHeadClass, className)} {...thProps}>
      <div className={cn(dataTableHeadInnerClass, headAlignClass(align))}>{children}</div>
    </th>
  );
}
