import { DataTableRoot } from './data-table-root';
import { DataTableTable } from './data-table-table';
import { DataTableHead } from './data-table-head';
import { DataTableBody } from './data-table-body';
import { DataTableRow } from './data-table-row';
import { DataTableHeader } from './data-table-header';
import { DataTableCell } from './data-table-cell';
import { DataTableRowHeader } from './data-table-row-header';
import { DataTableCaption } from './data-table-caption';
import { TableScroller } from './table-scroller';
import { SortableTableHeader } from './sortable-table-header';
import { dataTableHeadClass } from '../data-table.recipe';

export type {
  SortDir,
  DataTableRootProps,
  DataTableTableProps,
  DataTableHeaderAlign,
  DataTableHeaderStaticProps,
  DataTableHeaderSortableProps,
  DataTableHeaderProps,
  DataTableCellProps,
  DataTableRowHeaderProps,
  DataTableCaptionProps,
  TableScrollerProps,
  SortableTableHeaderProps,
} from './types';

export const DataTable = {
  Root: DataTableRoot,
  Table: DataTableTable,
  Head: DataTableHead,
  Body: DataTableBody,
  Row: DataTableRow,
  Header: DataTableHeader,
  Cell: DataTableCell,
  RowHeader: DataTableRowHeader,
  Caption: DataTableCaption,
};

export { TableScroller, SortableTableHeader };

/** @deprecated Prefer {@link dataTableHeadClass} from `data-table.recipe`. */
export const stickyHeadClass = dataTableHeadClass;
