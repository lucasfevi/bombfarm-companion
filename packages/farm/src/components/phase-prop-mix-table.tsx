'use client';

import {
  DataTable,
  Panel,
  formatNumber,
  panelHClass,
  panelTitleClass,
  phasesBoardPropsClass,
} from '@bombfarm/ui';
import { GoldValue, PropIcon } from '@bombfarm/game-art';
import { propLabel } from '@bombfarm/domain/game-labels';
import type { PhaseIntelGlobal } from '@bombfarm/domain/phase-intel';
import { useFarmCopy } from './farm-copy-context';

export function PhasePropMixTable({ intel }: { intel: PhaseIntelGlobal }) {
  const { t, lang } = useFarmCopy();

  return (
    <Panel className={phasesBoardPropsClass}>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.phasesSpawnMix}</h2>
      </div>
      <DataTable.Root scrollable maxRows={12} className="rounded-sm border border-line">
        <DataTable.Table>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header scope="col">{t.prop}</DataTable.Header>
              <DataTable.Header scope="col" align="right">
                HP
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.phasesColShare}
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.phasesColGoldWiki}
              </DataTable.Header>
              <DataTable.Header scope="col" align="right">
                {t.phasesColGoldActual}
              </DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {intel.propRows.map((row) => (
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
                  {formatNumber(row.weightShare * 100, lang, 1)}%
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric>
                  <GoldValue className="w-full justify-end">{formatNumber(row.goldWiki, lang, 0)}</GoldValue>
                </DataTable.Cell>
                <DataTable.Cell align="right" numeric className="text-accent">
                  <GoldValue className="w-full justify-end">{formatNumber(row.goldActual, lang, 0)}</GoldValue>
                </DataTable.Cell>
              </DataTable.Row>
            ))}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </Panel>
  );
}
