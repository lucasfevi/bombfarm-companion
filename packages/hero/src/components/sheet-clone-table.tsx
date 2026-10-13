'use client';

import { useMemo, type ReactNode } from 'react';

import { peelSheetStages } from '@bombfarm/domain/sheet-stages';
import { abilityName } from '@bombfarm/domain/game-labels';
import { STAT_CAPS } from '@bombfarm/domain/model';
import { SHEET_PANEL_KEYS } from '@bombfarm/domain/planner-constants';
import { TEAM_BUFF_CAP } from '@bombfarm/domain/team-buffs';
import type { Loadout } from '@bombfarm/domain/gear';
import {
  DataTable,
  InfoTip,
  Panel,
  cn,
  mutedClass,
  numberFormatterFor,
  panelHClass,
  panelTitleClass,
} from '@bombfarm/ui';
import { sub, type Lang, type SheetCloneCopy, type StatPanelCopy } from '../copy';
import { sheetStatUnit } from '../model/breakdown-labels';
import { cloneDeltaText, formatOverCapCell, stageColumnText } from '../model/sheet-cells';
import {
  sheetCloneDiff,
  type CloneDeltaTone,
  type SheetDiffCell,
  type SheetStageColumn,
} from '../model/sheet-clone-diff';
import type { SheetTableInput } from './sheet-table';

export type SheetCloneTableInput = Omit<SheetTableInput, 'loadout' | 'birth'> & {
  birth: NonNullable<SheetTableInput['birth']>;
};

const toneClass: Record<CloneDeltaTone, string> = {
  up: 'text-up',
  down: 'text-down',
  flat: mutedClass,
};

function Stacked({ current, clone }: { current: ReactNode; clone: ReactNode }) {
  return (
    <span className="flex flex-col items-end leading-tight" data-sheet-diff="changed">
      <span>{current}</span>
      <span className="text-accent">{clone}</span>
    </span>
  );
}

export function SheetCloneTable({
  t,
  lang,
  input,
  loadout,
  altLoadout,
}: {
  t: StatPanelCopy & SheetCloneCopy;
  lang: Lang;
  input: SheetCloneTableInput;
  loadout: Loadout;
  altLoadout: Loadout;
}) {
  const boundFormatNumber = useMemo(() => numberFormatterFor(lang), [lang]);
  const { birth, level, stars, sheetOther, pts, tree, runes } = input;

  const diff = useMemo(() => {
    const shared = { birth, level, stars, sheetOther, pts, tree, runes };
    return sheetCloneDiff(
      peelSheetStages({ ...shared, loadout }),
      peelSheetStages({ ...shared, loadout: altLoadout }),
    );
  }, [birth, level, stars, sheetOther, pts, tree, runes, loadout, altLoadout]);

  const critAuraTip = useMemo(
    () =>
      sub(t.critAuraCapTip, {
        aura: abilityName('pressagio_mortal', lang),
        amount: boundFormatNumber(TEAM_BUFF_CAP.pressagio_mortal, 0),
        threshold: boundFormatNumber(STAT_CAPS.critChance - TEAM_BUFF_CAP.pressagio_mortal, 0),
      }),
    [t.critAuraCapTip, lang, boundFormatNumber],
  );

  const showRune = runes !== undefined && runes.length > 0;
  const deltaHeaders: { key: SheetStageColumn; label: string }[] = [
    { key: 'deltaGear', label: t.colSheetDeltaGear },
    { key: 'deltaPoints', label: t.colSheetDeltaPoints },
    { key: 'deltaTree', label: t.colSheetDeltaTree },
    ...(showRune ? [{ key: 'deltaRune' as const, label: t.colSheetDeltaRune }] : []),
  ];

  return (
    <Panel data-testid="gear-clone-sheet">
      <div className={panelHClass}>
        <h2 className={panelTitleClass}>{t.panelCloneSheet}</h2>
        <InfoTip label={t.panelCloneSheet} tip={t.cloneSheetTip} />
      </div>
      <DataTable.Root className="overflow-x-auto">
        <DataTable.Table className="table-fixed">
          <colgroup>
            <col className="w-28" />
            {deltaHeaders.map(({ key }) => (
              <col key={key} className="w-24" />
            ))}
            <col className="w-24" />
            <col className="w-24" />
            <col className="w-36" />
          </colgroup>
          <DataTable.Head>
            <DataTable.Row>
              <DataTable.Header>{t.colStat}</DataTable.Header>
              {deltaHeaders.map(({ key, label }) => (
                <DataTable.Header key={key} align="right">
                  <span className="min-w-0 truncate">{label}</span>
                </DataTable.Header>
              ))}
              <DataTable.Header align="right">{t.colSheetTotal}</DataTable.Header>
              <DataTable.Header align="right">
                <span className="min-w-0 truncate">{t.colSheetDeltaClone}</span>
              </DataTable.Header>
              <DataTable.Header align="right">
                <span className="min-w-0 truncate">{t.colSheetOverCap}</span>
              </DataTable.Header>
            </DataTable.Row>
          </DataTable.Head>
          <DataTable.Body>
            {SHEET_PANEL_KEYS.map((statKey) => {
              const row = diff[statKey];
              const unit = sheetStatUnit(statKey);
              const cell = (column: SheetStageColumn, bold = false) => {
                const { current, clone, changed }: SheetDiffCell = row.cells[column];
                const currentText = stageColumnText(column, current, boundFormatNumber, unit);
                const body = changed ? (
                  <Stacked
                    current={currentText}
                    clone={stageColumnText(column, clone, boundFormatNumber, unit)}
                  />
                ) : (
                  currentText
                );
                return bold ? <b>{body}</b> : body;
              };
              const overCapCurrent = formatOverCapCell(row.overCap.current, boundFormatNumber, unit);
              return (
                <DataTable.Row key={statKey}>
                  <DataTable.Cell>
                    <span className="flex items-center gap-1">
                      <span className="min-w-0 truncate">{t.statShort[statKey]}</span>
                      {statKey === 'critChance' ? (
                        <InfoTip label={t.statShort[statKey]} tip={critAuraTip} />
                      ) : null}
                    </span>
                  </DataTable.Cell>
                  {deltaHeaders.map(({ key }) => (
                    <DataTable.Cell key={key} align="right" numeric className={mutedClass}>
                      {cell(key)}
                    </DataTable.Cell>
                  ))}
                  <DataTable.Cell align="right" numeric>
                    {cell('total', true)}
                  </DataTable.Cell>
                  <DataTable.Cell
                    align="right"
                    numeric
                    className={cn(toneClass[row.cloneDeltaTone])}
                    data-clone-delta={row.cloneDeltaTone}
                  >
                    <b>{cloneDeltaText(row.cloneDelta, row.cloneDeltaTone, boundFormatNumber, unit)}</b>
                  </DataTable.Cell>
                  <DataTable.Cell align="right" numeric className={mutedClass}>
                    {row.overCap.changed ? (
                      <Stacked
                        current={overCapCurrent}
                        clone={formatOverCapCell(row.overCap.clone, boundFormatNumber, unit)}
                      />
                    ) : (
                      overCapCurrent
                    )}
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
