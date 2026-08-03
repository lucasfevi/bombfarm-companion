import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import type { DataTableCellVariants } from '../data-table.recipe';

export type SortDir = 'asc' | 'desc';

export type DataTableRootProps = {
  /** Cap height and scroll the body under sticky headers. */
  scrollable?: boolean;
  /** Max visible rows (header + body) when `scrollable`. */
  maxRows?: number;
  /** Body row height driving the max-height cap when `scrollable`. */
  rowHeight?: string;
  className?: string;
  children: ReactNode;
};

export type DataTableTableProps = HTMLAttributes<HTMLTableElement>;

export type DataTableHeaderAlign = 'left' | 'center' | 'right';

type HeaderBaseProps = {
  align?: DataTableHeaderAlign;
  className?: string;
  children: ReactNode;
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, 'children' | 'align'>;

export type DataTableHeaderStaticProps = HeaderBaseProps & {
  sortable?: false;
};

export type DataTableHeaderSortableProps<T extends string> = HeaderBaseProps & {
  sortable: true;
  col: T;
  sortKey: T;
  sortDir: SortDir;
  onSort: (key: T) => void;
  stopPropagation?: boolean;
};

export type DataTableHeaderProps<T extends string = string> =
  | DataTableHeaderStaticProps
  | DataTableHeaderSortableProps<T>;

export type DataTableCellProps = TdHTMLAttributes<HTMLTableCellElement> &
  DataTableCellVariants & {
    align?: DataTableCellVariants['align'];
  };

export type DataTableRowHeaderProps = ThHTMLAttributes<HTMLTableCellElement> & {
  className?: string;
  children: ReactNode;
};

export type DataTableCaptionProps = HTMLAttributes<HTMLTableCaptionElement>;

/** @deprecated Prefer {@link dataTableHeadClass} from `data-table.recipe`. */
export type TableScrollerProps = DataTableRootProps;

/** Back-compat sortable header used by older call sites / stories. */
export type SortableTableHeaderProps<T extends string> = {
  col: T;
  label: string;
  sortKey: T;
  sortDir: SortDir;
  onSort: (key: T) => void;
  align?: 'left' | 'right';
  className?: string;
  stopPropagation?: boolean;
};
