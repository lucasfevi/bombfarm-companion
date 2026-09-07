'use client';

import { DataTable, formatNumber } from '@bombfarm/ui';
import { PropIcon } from '@bombfarm/game-art';
import { propLabel } from '@bombfarm/domain/game-labels';
import type { HeroPhaseFit } from '@bombfarm/domain/phase-intel';
import { useHeroCopy } from './hero-copy-context';

export function PhasesHeroFitTable({ propHits }: { propHits: HeroPhaseFit['propHits'] }) {
  const { t, lang } = useHeroCopy();

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
              <DataTable.Cell>
                <span className="flex items-center gap-1.5">
                  <PropIcon name={row.name} />
                  <span>{propLabel(row.name, lang)}</span>
                </span>
              </DataTable.Cell>
              <DataTable.Cell align="right" numeric>
                {formatNumber(row.hp, lang, 0)}
              </DataTable.Cell>
              <DataTable.Cell align="right" numeric>
                {Number.isFinite(row.hits) ? formatNumber(row.hits, lang, 0) : '∞'}
              </DataTable.Cell>
            </DataTable.Row>
          ))}
        </DataTable.Body>
      </DataTable.Table>
    </DataTable.Root>
  );
}
