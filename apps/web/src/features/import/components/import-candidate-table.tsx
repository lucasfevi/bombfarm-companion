'use client';

import type { ImportCandidate } from '@bombfarm/domain/import-save';
import { useAppLang } from '@/shared/context/app-lang';
import { DataTable } from '@bombfarm/ui';
import type { ImportSortDir, ImportSortKey } from '../model/compare-candidates';
import { ImportCandidateRow } from './import-candidate-row';

type SortState = {
  sortKey: ImportSortKey;
  sortDir: ImportSortDir;
  onSort: (key: ImportSortKey) => void;
};

/** `AD-BSP-26`/`AC-31` — review, not curate: no checkbox column, no select-all header cell. */
export function ImportCandidateTable({
  sorted,
  sort,
  expanded,
  onToggleExpand,
}: {
  sorted: ImportCandidate[];
  sort: SortState;
  expanded: string | null;
  onToggleExpand: (sourceId: string) => void;
}) {
  const { t, lang } = useAppLang();
  const { sortKey, sortDir, onSort } = sort;

  return (
    <DataTable.Root scrollable className="border border-line">
      <DataTable.Table>
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header className="w-11" aria-label={t.heroAvatarCol}>
              <span className="sr-only">{t.heroAvatarCol}</span>
            </DataTable.Header>
            <DataTable.Header
              sortable
              col="level"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            >
              {t.importColLevel}
            </DataTable.Header>
            <DataTable.Header sortable col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>
              {t.importColName}
            </DataTable.Header>
            <DataTable.Header
              sortable
              col="rarity"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            >
              {t.importColRarity}
            </DataTable.Header>
            <DataTable.Header sortable col="rank" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>
              {t.importColRank}
            </DataTable.Header>
            <DataTable.Header
              sortable
              col="power"
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
              align="right"
            >
              {t.importColPower}
            </DataTable.Header>
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {sorted.map((candidate) => (
            <ImportCandidateRow
              key={candidate.sourceId}
              candidate={candidate}
              expanded={expanded === candidate.sourceId}
              t={t}
              lang={lang}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
