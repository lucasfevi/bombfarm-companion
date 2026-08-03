'use client';

import { DataTable } from '@bombfarm/ui';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import { propLabel } from '@bombfarm/domain/game-labels';
import type { HeroPhaseFit } from '@bombfarm/domain/phase-intel';

export function PhasesHeroFitTable({ propHits }: { propHits: HeroPhaseFit['propHits'] }) {
  const { t, lang } = useAppLang();

  return (
    <DataTable.Root scrollable maxRows={12} className="mt-3 rounded-sm border border-line">
      <DataTable.Table>
        <DataTable.Head>
          <DataTable.Row>
            <DataTable.Header scope="col">{t.prop}</DataTable.Header>
            <DataTable.Header scope="col" align="right">
              HP
            </DataTable.Header>
            <DataTable.Header scope="col" align="right">
              {t.colHits}
            </DataTable.Header>
          </DataTable.Row>
        </DataTable.Head>
        <DataTable.Body>
          {propHits.map((row) => (
            <DataTable.Row
              key={row.name}
              className="border-b border-[color-mix(in_oklch,var(--line)_70%,transparent)]"
            >
              <DataTable.Cell>{propLabel(row.name, lang)}</DataTable.Cell>
              <DataTable.Cell align="right" numeric>
                {formatNumber(row.hp, 0)}
              </DataTable.Cell>
              <DataTable.Cell align="right" numeric>
                {Number.isFinite(row.hits) ? formatNumber(row.hits, 0) : '∞'}
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
