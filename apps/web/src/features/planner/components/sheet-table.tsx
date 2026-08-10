'use client';

import { peelSheetStages, type SheetStageRow } from '@bombfarm/domain/sheet-stages';
import { SHEET_PANEL_KEYS } from '@bombfarm/domain/planner-constants';
import { useAppLang } from '@/shared/context/app-lang';
import { formatNumber } from '@/shared/lib/format-number';
import { usePlannerStore, selectAdvisorPipeline } from '@/shared/stores';
import { DataTable, FieldRequired, Panel } from '@bombfarm/ui';
import {
  mutedClass,
  panelHClass,
  panelTitleClass,
  tipClass,
} from '@bombfarm/ui/panel-field.recipe';

const STAGE_DELTA_KEYS = [
  'deltaLevel',
  'deltaStars',
  'deltaAbility',
  'deltaGear',
  'deltaPoints',
  'deltaTree',
] as const;

type StageDeltaKey = (typeof STAGE_DELTA_KEYS)[number];

function formatStageCell(
  value: number,
  format: (n: number, d?: number) => string,
  asDelta: boolean,
): string {
  if (asDelta && Math.abs(value) < 1e-9) return '—';
  if (!asDelta) return format(value, 2);
  const abs = format(Math.abs(value), 2);
  return value < 0 ? `−${abs}` : `+${abs}`;
}

/**
 * The game's display clamp (`STAT_CAPS.critChance`/`.cdr`, `gameSheetView`), shown as its own
 * column rather than folded into Total — Total must stay the uncapped telescoping sum (see
 * `SheetStageRow`'s doc comment in `sheet-stages.ts`). `—` when the row sits at/under the cap
 * (`deltaCap` is exactly 0 there); otherwise the in-game value plus how much is being wasted,
 * e.g. `100.00 (−77.95)`.
 */
function formatOverCapCell(row: SheetStageRow, format: (n: number, d?: number) => string): string {
  if (row.deltaCap === 0) return '—';
  return `${format(row.cappedTotal, 2)} (${formatStageCell(row.deltaCap, format, true)})`;
}

export function SheetTable() {
  const { t } = useAppLang();

  const birth = usePlannerStore((state) => state.birth);
  const level = usePlannerStore((state) => state.level);
  const stars = usePlannerStore((state) => state.stars);
  const loadout = usePlannerStore((state) => state.loadout);
  const pts = usePlannerStore((state) => state.pts);

  const pipeline = usePlannerStore(selectAdvisorPipeline);
  const { sheetOther, treeSheet } = pipeline;

  const stages = birth
    ? peelSheetStages({
        birth,
        level,
        stars,
        sheetOther,
        loadout,
        pts,
        tree: treeSheet,
      })
    : null;

  const missingBirth = !birth;

  const deltaHeaders: { key: StageDeltaKey; label: string }[] = [
    { key: 'deltaLevel', label: t.colSheetDeltaLevel },
    { key: 'deltaStars', label: t.colSheetDeltaStars },
    { key: 'deltaAbility', label: t.colSheetDeltaAbility },
    { key: 'deltaGear', label: t.colSheetDeltaGear },
    { key: 'deltaPoints', label: t.colSheetDeltaPoints },
    { key: 'deltaTree', label: t.colSheetDeltaTree },
  ];

  return (
    <Panel>
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.panelSheet}</h2>
        <FieldRequired show={missingBirth}>{t.fieldRequired}</FieldRequired>
      </div>
      <p className={tipClass}>{missingBirth ? t.sheetTipNeedBirth : t.sheetTip}</p>
      <DataTable.Root scrollable maxRows={11} className="overflow-x-auto">
        <DataTable.Table className="table-fixed min-w-4xl">
          <colgroup>
            <col className="w-30" />
            <col className="w-22" />
            {STAGE_DELTA_KEYS.map((key) => (
              <col key={key} className="w-21" />
            ))}
            <col className="w-22" />
            <col className="w-28" />
          </colgroup>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header>{t.colStat}</DataTable.Header>
              <DataTable.Header align="right">{t.colSheetBirth}</DataTable.Header>
              {deltaHeaders.map(({ key, label }) => (
                <DataTable.Header key={key} align="right" title={label}>
                  <span className="min-w-0 truncate">{label}</span>
                </DataTable.Header>
              ))}
              <DataTable.Header align="right">{t.colSheetTotal}</DataTable.Header>
              <DataTable.Header align="right" title={t.colSheetOverCap}>
                <span className="min-w-0 truncate">{t.colSheetOverCap}</span>
              </DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {SHEET_PANEL_KEYS.map((statKey) => {
              const row: SheetStageRow | null = stages ? stages[statKey] : null;
              return (
                <DataTable.Row key={statKey}>
                  <DataTable.Cell className="truncate">{t.statShort[statKey]}</DataTable.Cell>
                  <DataTable.Cell align="right" numeric className={mutedClass}>
                    {row ? formatStageCell(row.birth, formatNumber, false) : '—'}
                  </DataTable.Cell>
                  {STAGE_DELTA_KEYS.map((deltaKey) => (
                    <DataTable.Cell key={deltaKey} align="right" numeric className={mutedClass}>
                      {row ? formatStageCell(row[deltaKey], formatNumber, true) : '—'}
                    </DataTable.Cell>
                  ))}
                  <DataTable.Cell align="right" numeric>
                    <b>{row ? formatStageCell(row.total, formatNumber, false) : '—'}</b>
                  </DataTable.Cell>
                  <DataTable.Cell align="right" numeric className={mutedClass}>
                    {row ? formatOverCapCell(row, formatNumber) : '—'}
                  </DataTable.Cell>
                </DataTable.Row>
              );
            })}
          </DataTable.Body>
        </DataTable.Table>
      </DataTable.Root>
    </Panel>
  );
}
