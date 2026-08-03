'use client';

import { DataTableRoot } from './data-table-root';
import type { TableScrollerProps } from './types';

/** @deprecated Prefer `<DataTable.Root scrollable>`. */
export function TableScroller(props: TableScrollerProps) {
  return <DataTableRoot scrollable {...props} />;
}
