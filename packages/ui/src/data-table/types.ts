import type { HTMLAttributes, ReactNode, Ref, TdHTMLAttributes, ThHTMLAttributes, UIEventHandler } from 'react';
import type { DataTableCellVariants } from '../data-table.recipe';

export type SortDir = 'asc' | 'desc';

export type DataTableRootProps = {
  /** Scroll the body under sticky headers. Parent height wins unless `maxRows` is set. */
  scrollable?: boolean;
  /** Optional max height in row units when `scrollable`. Omit to fill the parent. */
  maxRows?: number;
  /** Optional min height in row units when `scrollable`. */
  minRows?: number;
  /** Body row height driving min/max caps when `scrollable`. */
  rowHeight?: string;
  className?: string;
  children: ReactNode;
  /** Fires on the scroll container — a row-virtualizing caller reads `scrollTop` from it. */
  onScroll?: UIEventHandler<HTMLDivElement>;
  /** Ref to the scroll container div, for callers that need to read its metrics directly. */
  ref?: Ref<HTMLDivElement>;
} & Omit<HTMLAttributes<HTMLDivElement>, 'className' | 'children' | 'onScroll'>;

export type DataTableTableProps = HTMLAttributes<HTMLTableElement>;

export type DataTableHeaderAlign = 'left' | 'center' | 'right';

type HeaderBaseProps = {
  align?: DataTableHeaderAlign | undefined;
  className?: string | undefined;
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
