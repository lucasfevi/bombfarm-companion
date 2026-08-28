'use client';

import type { ImportCandidate } from '@bombfarm/domain/import-save';
import { useAppLang } from '@/shared/context/app-lang';
import { DataTable, Tooltip } from '@bombfarm/ui';
import type { ImportSortDir, ImportSortKey } from '../model/compare-candidates';
import { ImportCandidateRow } from './import-candidate-row';

type SortState = {
  sortKey: ImportSortKey;
  sortDir: ImportSortDir;
  onSort: (key: ImportSortKey) => void;
};

/** Review, not curate: no checkbox column, no select-all header cell. */
export function ImportCandidateTable({ sorted, sort }: { sorted: ImportCandidate[]; sort: SortState }) {
  const { t, lang } = useAppLang();
  const { sortKey, sortDir, onSort } = sort;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
    <Tooltip.Provider delay={200} closeDelay={80}>
      <DataTable.Root scrollable rowHeight="4.5rem" className="min-h-0 flex-1 border border-line">
        <DataTable.Table>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header className="w-14" aria-label={t.heroAvatarCol}>
                <span className="sr-only">{t.heroAvatarCol}</span>
              </DataTable.Header>
              <DataTable.Header
                sortable
                col="rank"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="w-10 max-[560px]:hidden"
              >
                {t.importColRank}
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
                className="max-[560px]:hidden"
              >
                {t.importColRarity}
              </DataTable.Header>
              <DataTable.Header sortable col="level" sortKey={sortKey} sortDir={sortDir} onSort={onSort}>
                {t.importColLevel}
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
              <DataTable.Header
                sortable
                col="gear"
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={onSort}
                className="min-w-100 max-[720px]:hidden"
              >
                {t.rosterColGear}
              </DataTable.Header>
              <DataTable.Header className="min-w-44 max-[960px]:hidden">
                {t.rosterColAbilities}
              </DataTable.Header>
              <DataTable.Header className="max-[720px]:hidden">{t.rosterColStatus}</DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {sorted.map((candidate) => (
              <ImportCandidateRow key={candidate.sourceId} candidate={candidate} t={t} lang={lang} />
            ))}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </Tooltip.Provider>
    </div>
  );
}
