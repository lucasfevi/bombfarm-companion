import { DataTable } from '@bombfarm/ui';
import type { SheetKey } from '@bombfarm/domain/planner-constants';

export type RosterSortKey = 'rank' | 'name' | 'rarity' | 'level' | 'power' | 'gear' | 'updated' | SheetKey;
export type RosterSortDir = 'asc' | 'desc';

export function RosterSortHeader({
  col,
  label,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
  className,
}: {
  col: RosterSortKey;
  label: string;
  sortKey: RosterSortKey;
  sortDir: RosterSortDir;
  onSort: (key: RosterSortKey) => void;
  align?: 'left' | 'right';
  className?: string;
}) {
  return (
    <DataTable.Header
      sortable
      col={col}
      sortKey={sortKey}
      sortDir={sortDir}
      onSort={onSort}
      align={align}
      className={className}
      stopPropagation
    >
      {label}
    </DataTable.Header>
  );
}
